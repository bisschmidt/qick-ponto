// Service do portal do colaborador — ficha ponto e solicitações
// (Vive dentro do M2 pra reaproveitar o contexto de marcação.)

import type { PrismaClient } from '@prisma/client'

export interface DiaFicha {
  data: string                          // YYYY-MM-DD
  diaSemana: number                     // 0=Dom..6=Sáb
  ehFeriado: boolean
  ehDsr: boolean
  status: string                        // OK, FALTA, FERIADO, DSR, INCOMPLETO
  jornadaContratual: { inicio: string; fim: string } | null
  marcacoes: { tipo: string; hora: string; nsr: string }[]
  totais: {
    minutosTrabalhados: number
    minutosHe50: number
    minutosHe100: number
    minutosAtraso: number
  }
  inconsistencias: string[]
  ajustes: { id: string; status: string; tipo_ajuste: string; motivo: string; justificativa: string; novo_timestamp: string | null; novo_tipo: string | null }[]
}

export function portalService(db: PrismaClient) {
  return {
    async minhaFicha(colaboradorId: string, tenantId: string, mesAno: string) {
      // mesAno: "YYYY-MM"
      const [ano, mes] = mesAno.split('-').map(Number)
      if (!ano || !mes) throw { statusCode: 400, message: 'mes inválido (use YYYY-MM)' }

      const inicio = new Date(`${mesAno}-01T00:00:00-03:00`)
      const ultimoDia = new Date(ano, mes, 0).getDate()
      const fim = new Date(`${mesAno}-${String(ultimoDia).padStart(2, '0')}T23:59:59.999-03:00`)

      const colaborador = await db.colaborador.findFirstOrThrow({
        where: { id: colaboradorId, tenant_id: tenantId },
        include: {
          jornadas: {
            where: { OR: [{ data_fim: null }, { data_fim: { gte: inicio } }] },
            include: { jornada: true },
          },
        },
      })
      const dataDesligamento: Date | null = colaborador.data_desligamento ?? null

      // Marcações do mês
      const marcacoes = await db.marcacao.findMany({
        where: {
          colaborador_id: colaboradorId,
          tenant_id: tenantId,
          timestamp_marcacao: { gte: inicio, lte: fim },
        },
        orderBy: { timestamp_marcacao: 'asc' },
      })

      // Jornada apurada
      const apuradas = await db.jornadaApurada.findMany({
        where: {
          colaborador_id: colaboradorId,
          tenant_id: tenantId,
          data_referencia: { gte: inicio, lte: fim },
        },
      })

      // Ajustes do mês
      const ajustes = await db.ajuste.findMany({
        where: {
          colaborador_id: colaboradorId,
          tenant_id: tenantId,
          data_ponto: { gte: inicio, lte: fim },
        },
        include: { motivo: { select: { descricao: true } } },
      })

      // Agrupa por dia (chave: YYYY-MM-DD em BRT)
      function chaveDiaBRT(d: Date): string {
        const brt = new Date(d.getTime() - 3 * 3600 * 1000)
        return brt.toISOString().slice(0, 10)
      }

      const marcacoesPorDia = new Map<string, typeof marcacoes>()
      for (const m of marcacoes) {
        const k = chaveDiaBRT(m.timestamp_marcacao)
        const lst = marcacoesPorDia.get(k) ?? []
        lst.push(m)
        marcacoesPorDia.set(k, lst)
      }

      const apuradasPorDia = new Map(apuradas.map((a) => [a.data_referencia.toISOString().slice(0, 10), a]))
      const ajustesPorDia = new Map<string, typeof ajustes>()
      for (const a of ajustes) {
        const k = a.data_ponto.toISOString().slice(0, 10)
        const lst = ajustesPorDia.get(k) ?? []
        lst.push(a)
        ajustesPorDia.set(k, lst)
      }

      // Feriados que cobrem qualquer parte do mês
      const feriados = await db.feriado.findMany({
        where: {
          tenant_id: tenantId,
          data_inicio: { lte: fim },
          data_fim: { gte: inicio },
        },
      })
      const feriadosSet = new Set<string>()
      for (const f of feriados) {
        for (let d = new Date(f.data_inicio); d <= f.data_fim; d.setUTCDate(d.getUTCDate() + 1)) {
          feriadosSet.add(d.toISOString().slice(0, 10))
        }
      }

      // Jornada vigente do colaborador
      const jornadaVigente = colaborador.jornadas[0]?.jornada ?? null

      const dias: DiaFicha[] = []
      for (let d = 1; d <= ultimoDia; d++) {
        const dataStr = `${mesAno}-${String(d).padStart(2, '0')}`
        const dataObj = new Date(`${dataStr}T12:00:00-03:00`)
        const diaSemana = dataObj.getDay()
        const ehFeriado = feriadosSet.has(dataStr)
        const apurada = apuradasPorDia.get(dataStr)
        const mdia = marcacoesPorDia.get(dataStr) ?? []
        const ajustadasDoDia = (ajustesPorDia.get(dataStr) ?? []).filter(
          (a) => a.status === 'APROVADO_RH' || a.status === 'APROVADO_GESTOR',
        )

        // Aplica ajustes aprovados nas marcações do dia
        type MarcacaoVirtual = { id: string; timestamp_marcacao: Date; tipo: string; nsr: bigint | number; virtual?: boolean }
        let marcacoesDia: MarcacaoVirtual[] = mdia.map((m) => ({
          id: m.id,
          timestamp_marcacao: m.timestamp_marcacao,
          tipo: m.tipo as string,
          nsr: m.nsr,
        }))

        for (const aj of ajustadasDoDia) {
          if (aj.tipo_ajuste === 'ATESTADO') continue
          if (aj.marcacao_ref_id && aj.novo_timestamp) {
            // Corrige o horário/tipo de uma marcação existente
            marcacoesDia = marcacoesDia.map((m) =>
              m.id === aj.marcacao_ref_id
                ? { ...m, timestamp_marcacao: aj.novo_timestamp!, tipo: (aj.novo_tipo ?? m.tipo) as string }
                : m,
            )
          } else if (!aj.marcacao_ref_id && aj.novo_timestamp && aj.novo_tipo) {
            // Inclui marcação faltante (ESQUECIMENTO / PAR_QUEBRADO)
            marcacoesDia.push({
              id: aj.id,
              timestamp_marcacao: aj.novo_timestamp,
              tipo: aj.novo_tipo as string,
              nsr: 0,
              virtual: true,
            })
          }
        }

        marcacoesDia.sort((a, b) => a.timestamp_marcacao.getTime() - b.timestamp_marcacao.getTime())

        const ehDiaTrabalho = jornadaVigente
          ? (jornadaVigente.dias_semana as number[]).includes(diaSemana)
          : false
        const ehDsr = !ehDiaTrabalho

        const hojeUTC = new Date()
        const hojeBRT = new Date(hojeUTC.getTime() - 3 * 3600 * 1000)
        const hojeStr = hojeBRT.toISOString().slice(0, 10)
        const ehPassado = dataStr < hojeStr

        const temSaidaAntecipada = ajustadasDoDia.some((a) => a.tipo_ajuste === 'SAIDA_ANTECIPADA')
        const temMarcacaoSaida = marcacoesDia.some((m) => m.tipo === 'SAIDA')

        // Dias após desligamento ficam como DESLIGADO independente de marcações
        const ehDesligado = dataDesligamento !== null
          && new Date(`${dataStr}T12:00:00Z`) > dataDesligamento

        let status = 'OK'
        if (ehDesligado) status = 'DESLIGADO'
        else if (ehFeriado) status = 'FERIADO'
        else if (ehDsr) status = 'DSR'
        else if (temSaidaAntecipada) status = 'SAIDA_ANTECIPADA'
        else if (apurada) status = apurada.status as string
        else if (marcacoesDia.length === 0) status = 'FALTA'
        else if (!temMarcacaoSaida && ehPassado) status = 'PONTO_SEM_SAIDA'
        else status = 'INCOMPLETO'

        dias.push({
          data: dataStr,
          diaSemana,
          ehFeriado,
          ehDsr,
          status,
          jornadaContratual: jornadaVigente
            ? { inicio: jornadaVigente.hora_inicio, fim: jornadaVigente.hora_fim }
            : null,
          marcacoes: marcacoesDia.map((m) => ({
            tipo: m.tipo,
            hora: m.timestamp_marcacao.toISOString(),
            nsr: m.nsr.toString(),
          })),
          totais: {
            minutosTrabalhados: apurada?.minutos_trabalhados ?? 0,
            minutosHe50: apurada?.minutos_he_50 ?? 0,
            minutosHe100: apurada?.minutos_he_100 ?? 0,
            minutosAtraso: apurada?.minutos_atraso ?? 0,
          },
          inconsistencias: apurada && Array.isArray(apurada.inconsistencias)
            ? (apurada.inconsistencias as string[])
            : [],
          ajustes: (ajustesPorDia.get(dataStr) ?? []).map((a) => ({
            id: a.id,
            status: a.status,
            tipo_ajuste: a.tipo_ajuste,
            motivo: a.motivo.descricao,
            justificativa: a.justificativa,
            novo_timestamp: a.novo_timestamp?.toISOString() ?? null,
            novo_tipo: a.novo_tipo ?? null,
          })),
        })
      }

      const totalMes = dias.reduce(
        (acc, d) => ({
          minutosTrabalhados: acc.minutosTrabalhados + d.totais.minutosTrabalhados,
          minutosHe50:        acc.minutosHe50        + d.totais.minutosHe50,
          minutosHe100:       acc.minutosHe100       + d.totais.minutosHe100,
          minutosAtraso:      acc.minutosAtraso      + d.totais.minutosAtraso,
          faltas:             acc.faltas             + (d.status === 'FALTA' ? 1 : 0),
        }),
        { minutosTrabalhados: 0, minutosHe50: 0, minutosHe100: 0, minutosAtraso: 0, faltas: 0 },
      )

      return {
        colaborador: {
          id: colaborador.id,
          nome: colaborador.nome_completo,
          matricula: colaborador.matricula,
        },
        mes: mesAno,
        jornadaContratual: jornadaVigente
          ? {
              nome: jornadaVigente.nome,
              tipo: jornadaVigente.tipo,
              hora_inicio: jornadaVigente.hora_inicio,
              hora_fim: jornadaVigente.hora_fim,
              dias_semana: jornadaVigente.dias_semana,
            }
          : null,
        dias,
        total: totalMes,
      }
    },

    // Lista os ajustes do colaborador (qualquer status)
    async minhasSolicitacoes(colaboradorId: string, tenantId: string) {
      return db.ajuste.findMany({
        where: { colaborador_id: colaboradorId, tenant_id: tenantId },
        include: { motivo: { select: { descricao: true } } },
        orderBy: { created_at: 'desc' },
        take: 100,
      })
    },
  }
}
