import type { PrismaClient, SistemaFolha, EventoFolhaTipo } from '@prisma/client'
import { m12Repo } from './repository.js'
import { getConnector, type EventoExportacao } from './connectors/index.js'

// Lista canônica de eventos suportados pela exportação.
// Tem que casar com o enum EventoFolhaTipo do Prisma.
export const EVENTOS_FOLHA: EventoFolhaTipo[] = [
  'HE_50',
  'HE_100',
  'ADICIONAL_NOTURNO',
  'FALTA',
  'FALTA_DSR',
  'ATRASO',
  'HORA_REDUZIDA',
]

export interface PendenciaValidacao {
  tipo: 'EVENTO_SEM_CODIGO' | 'COLAB_SEM_CODIGO' | 'EMPRESA_SEM_CODIGO' | 'PERIODO_NAO_FECHADO'
  descricao: string
  refId?: string
}

export function m12Service(db: PrismaClient) {
  const repo = m12Repo(db)

  return {
    // ─── Configuração ───────────────────────────────────────────────────
    getConfig: repo.getConfig,
    upsertConfig: repo.upsertConfig,

    // ─── Mapeamento ─────────────────────────────────────────────────────
    listarMapeamento: repo.listarMapeamento,
    upsertMapeamento: repo.upsertMapeamento,

    // ─── Código colaborador ─────────────────────────────────────────────
    upsertCodigoColaborador: repo.upsertCodigoColaborador,

    // ─── Histórico ──────────────────────────────────────────────────────
    listarHistorico: repo.listarHistorico,

    // ─── Validação prévia ───────────────────────────────────────────────
    async validar(params: {
      tenantId: string
      sistema: SistemaFolha
      cnpjEstabId: string
      competenciaIni: Date
      competenciaFim: Date
    }): Promise<{ ok: boolean; pendencias: PendenciaValidacao[] }> {
      const pendencias: PendenciaValidacao[] = []

      // 1. Período fechado?
      const periodoFechado = await db.periodoFechamento.findFirst({
        where: {
          tenant_id: params.tenantId,
          data_inicio: { lte: params.competenciaFim },
          data_fim:    { gte: params.competenciaIni },
          fechado:     true,
        },
      })
      if (!periodoFechado) {
        pendencias.push({
          tipo: 'PERIODO_NAO_FECHADO',
          descricao: 'O período precisa estar fechado antes de exportar para folha',
        })
      }

      // 2. Config do sistema?
      const cfg = await repo.getConfig(params.tenantId, params.sistema)
      if (!cfg || !cfg.codigo_empresa) {
        pendencias.push({
          tipo: 'EMPRESA_SEM_CODIGO',
          descricao: `Cadastre o código da empresa em ${params.sistema}`,
        })
      }

      // 3. Quais eventos efetivamente ocorreram no período?
      const eventosOcorridos = await this._levantarEventosOcorridos(params)

      // 4. Mapeamento de eventos completo para os que ocorreram?
      const mapeamentos = await repo.listarMapeamento(params.tenantId, params.sistema)
      const mapMap = new Map(mapeamentos.map((m) => [m.evento, m.codigo_externo]))
      const eventosSemMapeamento = eventosOcorridos.filter((e) => !mapMap.get(e))
      for (const e of eventosSemMapeamento) {
        pendencias.push({
          tipo: 'EVENTO_SEM_CODIGO',
          descricao: `Evento "${e}" sem código mapeado em ${params.sistema}`,
          refId: e,
        })
      }

      // 5. Colaboradores com lançamentos no período sem código no sistema externo?
      const colabsComLancamento = await this._colaboradoresComLancamento(params)
      const codigosColabs = await repo.listarCodigosColaboradoresDoTenant(
        params.tenantId,
        params.sistema,
      )
      const codigosMap = new Map(codigosColabs.map((c) => [c.colaborador_id, c.codigo]))
      const colabsSemCodigo = colabsComLancamento.filter((c) => !codigosMap.get(c.id))
      for (const c of colabsSemCodigo) {
        pendencias.push({
          tipo: 'COLAB_SEM_CODIGO',
          descricao: `${c.nome_completo} (${c.matricula}) — sem código em ${params.sistema}`,
          refId: c.id,
        })
      }

      return { ok: pendencias.length === 0, pendencias }
    },

    // ─── Geração do arquivo ─────────────────────────────────────────────
    async exportar(params: {
      tenantId: string
      sistema: SistemaFolha
      cnpjEstabId: string
      competenciaIni: Date
      competenciaFim: Date
      solicitanteId: string
    }) {
      // Revalida na hora da exportação (pode ter mudado entre validar e exportar)
      const validacao = await this.validar(params)
      if (!validacao.ok) {
        throw {
          statusCode: 422,
          message: 'Validação falhou',
          pendencias: validacao.pendencias,
        }
      }

      const cfg = await repo.getConfig(params.tenantId, params.sistema)
      const mapeamentos = await repo.listarMapeamento(params.tenantId, params.sistema)
      const mapMap = new Map(mapeamentos.map((m) => [m.evento, m.codigo_externo]))
      const codigosColabs = await repo.listarCodigosColaboradoresDoTenant(
        params.tenantId,
        params.sistema,
      )
      const codColabMap = new Map(codigosColabs.map((c) => [c.colaborador_id, c.codigo]))

      // Levanta totais por colaborador × evento
      const totais = await this._agregarEventos(params)

      const eventos: EventoExportacao[] = []
      for (const t of totais) {
        const codigoExternoEvento = mapMap.get(t.evento)!
        const codigoExternoColaborador = codColabMap.get(t.colaboradorId)!
        const ev: EventoExportacao = {
          colaboradorId: t.colaboradorId,
          colaboradorNome: t.colaboradorNome,
          codigoExternoColaborador,
          evento: t.evento,
          codigoExternoEvento,
        }
        if (t.minutos !== undefined) ev.quantidadeMinutos = t.minutos
        if (t.dias !== undefined) ev.quantidadeDias = t.dias
        eventos.push(ev)
      }

      const connector = getConnector(params.sistema)
      const resultado = connector.gerarArquivo({
        sistema: params.sistema,
        codigoEmpresa: cfg!.codigo_empresa,
        cnpjEstabId: params.cnpjEstabId,
        competenciaInicio: params.competenciaIni,
        competenciaFim: params.competenciaFim,
        tenantId: params.tenantId,
        eventos,
      })

      const periodoFechado = await db.periodoFechamento.findFirst({
        where: {
          tenant_id: params.tenantId,
          data_inicio: { lte: params.competenciaFim },
          data_fim:    { gte: params.competenciaIni },
          fechado:     true,
        },
      })

      await repo.registrarExportacao({
        tenantId: params.tenantId,
        sistema: params.sistema,
        cnpjEstabId: params.cnpjEstabId,
        periodoId: periodoFechado?.id ?? null,
        competenciaIni: params.competenciaIni,
        competenciaFim: params.competenciaFim,
        solicitanteId: params.solicitanteId,
        totalLinhas: resultado.totalLinhas,
        nomeArquivo: resultado.nomeArquivo,
      })

      return resultado
    },

    // ─── Helpers internos ────────────────────────────────────────────────

    // Lista de tipos de evento que efetivamente ocorreram no período
    async _levantarEventosOcorridos(params: {
      tenantId: string
      competenciaIni: Date
      competenciaFim: Date
    }): Promise<EventoFolhaTipo[]> {
      const agreg = await db.jornadaApurada.aggregate({
        where: {
          tenant_id: params.tenantId,
          data_referencia: { gte: params.competenciaIni, lte: params.competenciaFim },
        },
        _sum: {
          minutos_he_50: true,
          minutos_he_100: true,
          minutos_ad_noturno: true,
          minutos_atraso: true,
          minutos_saida_antecipada: true,
          minutos_hora_reduzida: true,
        },
      })
      const eventos: EventoFolhaTipo[] = []
      if ((agreg._sum.minutos_he_50 ?? 0) > 0) eventos.push('HE_50')
      if ((agreg._sum.minutos_he_100 ?? 0) > 0) eventos.push('HE_100')
      if ((agreg._sum.minutos_ad_noturno ?? 0) > 0) eventos.push('ADICIONAL_NOTURNO')
      const totalAtraso = (agreg._sum.minutos_atraso ?? 0) + (agreg._sum.minutos_saida_antecipada ?? 0)
      if (totalAtraso > 0) eventos.push('ATRASO')
      if ((agreg._sum.minutos_hora_reduzida ?? 0) > 0) eventos.push('HORA_REDUZIDA')

      const faltas = await db.jornadaApurada.count({
        where: {
          tenant_id: params.tenantId,
          status: 'FALTA',
          data_referencia: { gte: params.competenciaIni, lte: params.competenciaFim },
        },
      })
      if (faltas > 0) {
        eventos.push('FALTA')
        eventos.push('FALTA_DSR')
      }
      return eventos
    },

    // Colaboradores que tiveram lançamento no período (não-zero em qualquer evento, ou status FALTA)
    async _colaboradoresComLancamento(params: {
      tenantId: string
      competenciaIni: Date
      competenciaFim: Date
    }): Promise<{ id: string; nome_completo: string; matricula: string }[]> {
      const apuradas = await db.jornadaApurada.findMany({
        where: {
          tenant_id: params.tenantId,
          data_referencia: { gte: params.competenciaIni, lte: params.competenciaFim },
          OR: [
            { status: 'FALTA' },
            { minutos_he_50:        { gt: 0 } },
            { minutos_he_100:       { gt: 0 } },
            { minutos_ad_noturno:   { gt: 0 } },
            { minutos_atraso:       { gt: 0 } },
            { minutos_saida_antecipada: { gt: 0 } },
            { minutos_hora_reduzida:    { gt: 0 } },
          ],
        },
        select: { colaborador_id: true },
      })
      const ids = Array.from(new Set(apuradas.map((a) => a.colaborador_id)))
      if (ids.length === 0) return []
      return db.colaborador.findMany({
        where: { id: { in: ids } },
        select: { id: true, nome_completo: true, matricula: true },
        orderBy: { matricula: 'asc' },
      })
    },

    // Totais por colaborador × evento, prontos pra mandar pro connector
    async _agregarEventos(params: {
      tenantId: string
      competenciaIni: Date
      competenciaFim: Date
    }) {
      const apuradas = await db.jornadaApurada.findMany({
        where: {
          tenant_id: params.tenantId,
          data_referencia: { gte: params.competenciaIni, lte: params.competenciaFim },
        },
        include: { colaborador: { select: { id: true, nome_completo: true } } },
      })

      type Linha = {
        colaboradorId: string
        colaboradorNome: string
        evento: EventoFolhaTipo
        minutos?: number
        dias?: number
      }
      const por = new Map<string, Linha>()
      const add = (colId: string, nome: string, ev: EventoFolhaTipo, minutos: number, dias = 0) => {
        if (minutos === 0 && dias === 0) return
        const k = `${colId}|${ev}`
        const atual = por.get(k)
        if (atual) {
          atual.minutos = (atual.minutos ?? 0) + minutos
          atual.dias = (atual.dias ?? 0) + dias
        } else {
          por.set(k, { colaboradorId: colId, colaboradorNome: nome, evento: ev, minutos, dias })
        }
      }

      // Ajustes aprovados — para excluir faltas já justificadas
      const ajustes = await db.ajuste.findMany({
        where: {
          tenant_id: params.tenantId,
          status: 'APROVADO_RH',
          data_ponto: { gte: params.competenciaIni, lte: params.competenciaFim },
        },
        include: { motivo: true },
      })
      const ajusteMap = new Set(
        ajustes.map((a) => `${a.colaborador_id}|${a.data_ponto.toISOString().slice(0, 10)}`),
      )
      // Motivos que são "atestado" → eSocial S-2230, NÃO entra no Questor
      const atestadoMap = new Set(
        ajustes
          .filter((a) => /atestado/i.test(a.motivo.descricao))
          .map((a) => `${a.colaborador_id}|${a.data_ponto.toISOString().slice(0, 10)}`),
      )

      for (const j of apuradas) {
        const cid = j.colaborador.id
        const nome = j.colaborador.nome_completo
        add(cid, nome, 'HE_50',             j.minutos_he_50)
        add(cid, nome, 'HE_100',            j.minutos_he_100)
        add(cid, nome, 'ADICIONAL_NOTURNO', j.minutos_ad_noturno)
        add(cid, nome, 'ATRASO',            j.minutos_atraso + j.minutos_saida_antecipada)
        add(cid, nome, 'HORA_REDUZIDA',     j.minutos_hora_reduzida)

        if (j.status === 'FALTA') {
          const chave = `${cid}|${j.data_referencia.toISOString().slice(0, 10)}`
          // Atestado entra como eSocial → fora do arquivo Questor
          if (atestadoMap.has(chave)) continue
          // Falta justificada por outro motivo (abono, folga) — também não entra como falta
          if (ajusteMap.has(chave)) continue
          add(cid, nome, 'FALTA', 0, 1)
          // 1 falta → 1 DSR perdido (regra simplificada CLT)
          add(cid, nome, 'FALTA_DSR', 0, 1)
        }
      }

      return Array.from(por.values())
    },
  }
}
