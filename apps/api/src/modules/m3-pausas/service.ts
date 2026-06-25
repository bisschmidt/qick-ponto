import type { PrismaClient } from '@prisma/client'
import {
  calcularStatusNr17,
  type PausaConfigNr17,
} from './engine/calcular-status-nr17.js'

export function m3Service(db: PrismaClient) {
  return {
    // Painel em tempo real: status atual de um colaborador
    async painelNr17(tenantId: string, colaboradorId: string) {
      const agora = new Date()
      const inicioDia = new Date(agora)
      inicioDia.setUTCHours(0, 0, 0, 0)
      const fimDia = new Date(agora)
      fimDia.setUTCHours(23, 59, 59, 999)

      // Marcações de hoje
      const marcacoes = await db.marcacao.findMany({
        where: {
          tenant_id: tenantId,
          colaborador_id: colaboradorId,
          timestamp_marcacao: { gte: inicioDia, lte: fimDia },
        },
        orderBy: { timestamp_marcacao: 'asc' },
        select: { tipo: true, timestamp_marcacao: true },
      })

      // Jornada vigente hoje
      const vigencia = await db.colaboradorJornada.findFirst({
        where: {
          colaborador_id: colaboradorId,
          data_inicio: { lte: agora },
          OR: [{ data_fim: null }, { data_fim: { gte: agora } }],
        },
        orderBy: { data_inicio: 'desc' },
        include: {
          jornada: { include: { pausas: true, horarios: true } },
        },
      })

      if (!vigencia) {
        return calcularStatusNr17({
          agora,
          entrada: null,
          saida: null,
          duracaoJornadaMin: 0,
          pausasConfig: [],
          marcacoesDia: [],
        })
      }

      const { jornada } = vigencia
      // Horário do dia atual (override por dia da semana; fallback no base)
      const diaSemana = agora.getUTCDay()
      const horarioDia = jornada.horarios?.find((h) => h.dia_semana === diaSemana)
      const horaInicioDia = horarioDia?.hora_inicio ?? jornada.hora_inicio
      const horaFimDia = horarioDia?.hora_fim ?? jornada.hora_fim

      const pausasConfig: PausaConfigNr17[] = jornada.pausas.map((p) => ({
        id: p.id,
        ordem: p.ordem,
        duracaoMinMin: p.duracao_min,
        ehNr17: p.eh_nr17,
        ehIntervaloRefeicao: p.eh_intervalo_refeicao,
        computaNaJornada: p.computa_jornada,
        janelaInicioMin: p.janela_inicio_min ?? null,
        janelaFimMin: p.janela_fim_min ?? null,
      }))

      const entrada = marcacoes.find((m) => m.tipo === 'ENTRADA')
      const saida = marcacoes.find(
        (m) => m.tipo === 'SAIDA' || m.tipo === 'SAIDA_HE' || m.tipo === 'SAIDA_COMPENSACAO',
      )

      return calcularStatusNr17({
        agora,
        entrada: entrada?.timestamp_marcacao ?? null,
        saida: saida?.timestamp_marcacao ?? null,
        duracaoJornadaMin: calcularDuracao(horaInicioDia, horaFimDia),
        pausasConfig,
        marcacoesDia: marcacoes.map((m) => ({
          tipo: m.tipo,
          timestamp: m.timestamp_marcacao,
        })),
      })
    },

    // Relatório de conformidade NR-17 de um período
    async relatorioConformidade(
      tenantId: string,
      cnpjEstabId: string,
      dataInicio: Date,
      dataFim: Date,
    ) {
      // Busca apurações já calculadas pelo M4 (que tem pausas_nr17_conformes)
      const apuracoes = await db.jornadaApurada.findMany({
        where: {
          tenant_id: tenantId,
          data_referencia: { gte: dataInicio, lte: dataFim },
          colaborador: { cnpj_estab_id: cnpjEstabId },
        },
        include: {
          colaborador: {
            select: { nome_completo: true, matricula: true },
          },
        },
        orderBy: [{ colaborador_id: 'asc' }, { data_referencia: 'asc' }],
      })

      // Agrupar por colaborador
      const porColaborador = new Map<
        string,
        { nome: string; matricula: string; diasTotal: number; diasConformes: number }
      >()

      for (const ap of apuracoes) {
        const chave = ap.colaborador_id
        const atual = porColaborador.get(chave) ?? {
          nome: ap.colaborador.nome_completo,
          matricula: ap.colaborador.matricula,
          diasTotal: 0,
          diasConformes: 0,
        }
        atual.diasTotal++
        if (ap.pausas_nr17_conformes) atual.diasConformes++
        porColaborador.set(chave, atual)
      }

      return {
        periodo: { inicio: dataInicio, fim: dataFim },
        cnpjEstabId,
        colaboradores: Array.from(porColaborador.entries()).map(([id, dados]) => ({
          colaboradorId: id,
          nome: dados.nome,
          matricula: dados.matricula,
          diasTotal: dados.diasTotal,
          diasConformes: dados.diasConformes,
          taxaConformidade: dados.diasTotal > 0
            ? Math.round((dados.diasConformes / dados.diasTotal) * 100)
            : 100,
        })),
      }
    },
  }
}

function calcularDuracao(horaInicio: string, horaFim: string): number {
  const [hi, mi] = horaInicio.split(':').map(Number) as [number, number]
  const [hf, mf] = horaFim.split(':').map(Number) as [number, number]
  let ini = hi * 60 + mi
  let fim = hf * 60 + mf
  if (fim <= ini) fim += 24 * 60
  return fim - ini
}
