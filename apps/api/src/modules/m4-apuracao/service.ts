import type { PrismaClient } from '@prisma/client'
import type { EntradaApuracao } from './types.js'
import { calcularDia } from './engine/calcular-dia.js'
import {
  buscarMarcacoesParaApuracao,
  buscarJornadaVigente,
  buscarFeriadosDoPeriodo,
  salvarJornadasApuradas,
  buscarJornadasApuradas,
  buscarResumoApuracao,
} from './repository.js'

function diasDoPeriodo(inicio: Date, fim: Date): Date[] {
  const dias: Date[] = []
  const cursor = new Date(inicio)
  cursor.setUTCHours(0, 0, 0, 0)
  const limite = new Date(fim)
  limite.setUTCHours(0, 0, 0, 0)
  while (cursor <= limite) {
    dias.push(new Date(cursor))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return dias
}

function ehPossivDsr(data: Date): boolean {
  return data.getUTCDay() === 0
}

function calcularDuracaoMinutos(horaInicio: string, horaFim: string): number {
  const [hi, mi] = horaInicio.split(':').map(Number) as [number, number]
  const [hf, mf] = horaFim.split(':').map(Number) as [number, number]
  let totalInicio = hi * 60 + mi
  let totalFim = hf * 60 + mf
  if (totalFim <= totalInicio) totalFim += 24 * 60
  return totalFim - totalInicio
}

function expandirFeriados(feriados: Array<{ data_inicio: Date; data_fim: Date }>): Set<string> {
  const set = new Set<string>()
  for (const f of feriados) {
    const cursor = new Date(f.data_inicio)
    const fim = new Date(f.data_fim)
    while (cursor <= fim) {
      set.add(cursor.toISOString().slice(0, 10))
      cursor.setDate(cursor.getDate() + 1)
    }
  }
  return set
}

export function m4Service(db: PrismaClient) {
  return {
    async apurarPeriodo(
      tenantId: string,
      colaboradorId: string,
      dataInicio: Date,
      dataFim: Date,
    ) {
      // Bloqueia se o intervalo cobre algum período já fechado pelo RH
      const periodoFechado = await db.periodoFechamento.findFirst({
        where: {
          tenant_id: tenantId,
          fechado: true,
          data_inicio: { lte: dataFim },
          data_fim:    { gte: dataInicio },
        },
      })
      if (periodoFechado) {
        const inicio = periodoFechado.data_inicio.toISOString().slice(0, 10)
        const fim    = periodoFechado.data_fim.toISOString().slice(0, 10)
        throw {
          statusCode: 422,
          message: `Período ${inicio} a ${fim} já foi fechado pelo RH — reapuração bloqueada`,
        }
      }

      const colaborador = await db.colaborador.findUniqueOrThrow({
        where: { id: colaboradorId },
        include: { cnpj_estab: true },
      })

      const feriados = await buscarFeriadosDoPeriodo(
        db,
        tenantId,
        dataInicio,
        dataFim,
        colaborador.cnpj_estab.uf,
        null,
      )
      const feriadosSet = expandirFeriados(feriados)

      const marcacoes = await buscarMarcacoesParaApuracao(
        db,
        tenantId,
        colaboradorId,
        dataInicio,
        dataFim,
      )

      const marcacoesPorDia = new Map<string, typeof marcacoes>()
      for (const m of marcacoes) {
        const chave = m.timestamp_marcacao.toISOString().slice(0, 10)
        const lista = marcacoesPorDia.get(chave) ?? []
        lista.push(m)
        marcacoesPorDia.set(chave, lista)
      }

      const diasCalculados = []

      for (const dia of diasDoPeriodo(dataInicio, dataFim)) {
        const chave = dia.toISOString().slice(0, 10)
        const marcacoesDoDia = marcacoesPorDia.get(chave) ?? []

        const jornada = await buscarJornadaVigente(db, colaboradorId, dia)
        if (!jornada) continue

        // Dia da semana em BRT: 'dia' é UTC midnight; em BRT pode ser o dia anterior.
        // Para BRT (UTC-3): o dia BRT começa às 03:00 UTC.
        // Usamos a data UTC diretamente pois o período contratado começa após 03:00 UTC.
        const diaSemana = dia.getUTCDay() // 0=Dom, 1=Seg, …, 6=Sáb
        const ehDiaDeTrabalho = (jornada.dias_semana as number[]).includes(diaSemana)
        const ehDsr = !ehDiaDeTrabalho || ehPossivDsr(dia)

        // Dias fora da escala sem marcação → pula (não gera inconsistência)
        if (!ehDiaDeTrabalho && marcacoesDoDia.length === 0) continue

        const duracaoMinutos = calcularDuracaoMinutos(jornada.hora_inicio, jornada.hora_fim)

        const entrada: EntradaApuracao = {
          colaboradorId,
          data: dia,
          jornada: {
            horaInicio: jornada.hora_inicio,
            horaFim: jornada.hora_fim,
            duracaoMinutos,
            toleranciaEntradaMin: jornada.tolerancia_atraso_entrada,
            toleranciaSaidaMin: jornada.tolerancia_antec_saida,
            toleranciaIntervalMin: jornada.tolerancia_atraso_intervalo,
            pausas: jornada.pausas.map((p) => ({
              ordemNaSequencia: p.ordem,
              duracaoMinMin: p.duracao_min,
              computaNaJornada: p.computa_jornada,
              ehNr17: p.eh_nr17,
              ehIntervaloRefeicao: p.eh_intervalo_refeicao,
            })),
          },
          marcacoes: marcacoesDoDia.map((m) => ({
            tipo: m.tipo,
            timestamp: m.timestamp_marcacao,
          })),
          ehFeriado: feriadosSet.has(chave),
          ehDsr,
          aliquotaHe50: 50,
          aliquotaHe100: 100,
          aliquotaNoturno: 20,
        }

        diasCalculados.push(calcularDia(entrada))
      }

      if (diasCalculados.length > 0) {
        await salvarJornadasApuradas(db, tenantId, diasCalculados)
      }

      const totais = diasCalculados.reduce(
        (acc, d) => ({
          minutosTrabalhados: acc.minutosTrabalhados + d.minutosTrabalhados,
          minutosHe50:        acc.minutosHe50        + d.minutosHe50,
          minutosHe100:       acc.minutosHe100       + d.minutosHe100,
          minutosAtraso:      acc.minutosAtraso      + d.minutosAtraso,
          faltas:             acc.faltas             + (d.status === 'FALTA' ? 1 : 0),
        }),
        { minutosTrabalhados: 0, minutosHe50: 0, minutosHe100: 0, minutosAtraso: 0, faltas: 0 },
      )

      return {
        colaboradorId,
        periodo: { inicio: dataInicio, fim: dataFim },
        diasApurados: diasCalculados.length,
        ...totais,
        inconsistencias: diasCalculados.flatMap((d) =>
          d.inconsistencias.map((i) => ({
            data: d.data.toISOString().slice(0, 10),
            descricao: i,
          })),
        ),
      }
    },

    async apurarLote(
      tenantId: string,
      dataInicio: Date,
      dataFim: Date,
    ) {
      // Bloqueia se o intervalo cobre algum período já fechado
      const periodoFechado = await db.periodoFechamento.findFirst({
        where: {
          tenant_id: tenantId,
          fechado: true,
          data_inicio: { lte: dataFim },
          data_fim:    { gte: dataInicio },
        },
      })
      if (periodoFechado) {
        const inicio = periodoFechado.data_inicio.toISOString().slice(0, 10)
        const fim    = periodoFechado.data_fim.toISOString().slice(0, 10)
        throw {
          statusCode: 422,
          message: `Período ${inicio} a ${fim} já foi fechado pelo RH — reapuração bloqueada`,
        }
      }

      const colaboradores = await db.colaborador.findMany({
        where: { tenant_id: tenantId, ativo: true },
        select: { id: true, nome_completo: true, matricula: true },
        orderBy: { matricula: 'asc' },
      })

      const resultados = []
      const erros = []

      for (const colab of colaboradores) {
        try {
          const r = await this.apurarPeriodo(tenantId, colab.id, dataInicio, dataFim)
          resultados.push({
            colaborador_id: colab.id,
            nome: colab.nome_completo,
            matricula: colab.matricula,
            dias_apurados: r.diasApurados,
            inconsistencias: r.inconsistencias.length,
          })
        } catch (err) {
          erros.push({
            colaborador_id: colab.id,
            nome: colab.nome_completo,
            matricula: colab.matricula,
            erro: err instanceof Error ? err.message : String(err),
          })
        }
      }

      return {
        periodo: {
          inicio: dataInicio.toISOString().slice(0, 10),
          fim: dataFim.toISOString().slice(0, 10),
        },
        total_colaboradores: colaboradores.length,
        apurados: resultados.length,
        falhas: erros.length,
        resultados,
        erros,
      }
    },

    async buscarApuracao(
      tenantId: string,
      colaboradorId: string,
      dataInicio: Date,
      dataFim: Date,
    ) {
      return buscarJornadasApuradas(db, tenantId, colaboradorId, dataInicio, dataFim)
    },

    // Lista inconsistências (bloqueiam fechamento) e faltas (informativas) do período
    async listarInconsistenciasPendentes(
      tenantId: string,
      dataInicio: Date,
      dataFim: Date,
    ) {
      const jornadas = await db.jornadaApurada.findMany({
        where: {
          tenant_id: tenantId,
          data_referencia: { gte: dataInicio, lte: dataFim },
          OR: [
            { status: 'FALTA' },
            { NOT: { inconsistencias: { equals: [] } } },
          ],
        },
        include: {
          colaborador: { select: { id: true, nome_completo: true, matricula: true } },
        },
        orderBy: [{ data_referencia: 'asc' }, { colaborador: { matricula: 'asc' } }],
      })

      const ajustesAprovados = await db.ajuste.findMany({
        where: {
          tenant_id: tenantId,
          status: 'APROVADO_RH',
          data_ponto: { gte: dataInicio, lte: dataFim },
        },
        include: { motivo: { select: { descricao: true } } },
      })

      const ajustesMap = new Map<string, typeof ajustesAprovados[number]>()
      for (const a of ajustesAprovados) {
        const key = `${a.colaborador_id}|${a.data_ponto.toISOString().slice(0, 10)}`
        ajustesMap.set(key, a)
      }

      const inconsistencias: Array<{
        colaborador_id: string
        colaborador_nome: string
        colaborador_matricula: string
        data: string
        descricoes: string[]
        ja_justificado: boolean
        motivo_justificado: string | null
      }> = []
      const faltas: typeof inconsistencias = []

      for (const j of jornadas) {
        const dataStr = j.data_referencia.toISOString().slice(0, 10)
        const key = `${j.colaborador_id}|${dataStr}`
        const ajuste = ajustesMap.get(key)
        const descricoes = Array.isArray(j.inconsistencias) ? (j.inconsistencias as string[]) : []
        const item = {
          colaborador_id: j.colaborador_id,
          colaborador_nome: j.colaborador.nome_completo,
          colaborador_matricula: j.colaborador.matricula,
          data: dataStr,
          descricoes,
          ja_justificado: !!ajuste,
          motivo_justificado: ajuste?.motivo.descricao ?? null,
        }

        if (descricoes.length > 0) {
          // Tem problema real de marcação — bloqueia fechamento
          inconsistencias.push(item)
        } else if (j.status === 'FALTA') {
          // Falta legítima (sem inconsistência) — informativo, justificar é opcional
          faltas.push(item)
        }
      }

      return { inconsistencias, faltas }
    },

    async buscarResumoPeriodo(
      tenantId: string,
      dataInicio: Date,
      dataFim: Date,
    ) {
      const raw = await buscarResumoApuracao(db, tenantId, dataInicio, dataFim)

      // Conta faltas diretamente (status FALTA nas jornadas apuradas do período)
      const faltas = await db.jornadaApurada.count({
        where: {
          tenant_id: tenantId,
          data_referencia: { gte: dataInicio, lte: dataFim },
          status: 'FALTA',
        },
      })

      return {
        totalColaboradores: raw.length,
        diasApurados: raw.reduce((acc, r) => acc + (r._count._all ?? 0), 0),
        minutosTrabalhados: raw.reduce((acc, r) => acc + (r._sum.minutos_trabalhados ?? 0), 0),
        minutosHe50:  raw.reduce((acc, r) => acc + (r._sum.minutos_he_50  ?? 0), 0),
        minutosHe100: raw.reduce((acc, r) => acc + (r._sum.minutos_he_100 ?? 0), 0),
        minutosAtraso: raw.reduce((acc, r) => acc + (r._sum.minutos_atraso ?? 0), 0),
        faltas,
      }
    },
  }
}
