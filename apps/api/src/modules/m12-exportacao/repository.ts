import type { PrismaClient, SistemaFolha, EventoFolhaTipo } from '@prisma/client'

export function m12Repo(db: PrismaClient) {
  return {
    // ── Configuração ──────────────────────────────────────────────────────
    async getConfig(tenantId: string, sistema: SistemaFolha) {
      return db.configExportacaoFolha.findUnique({
        where: { tenant_id_sistema: { tenant_id: tenantId, sistema } },
      })
    },

    async upsertConfig(tenantId: string, sistema: SistemaFolha, codigoEmpresa: string) {
      return db.configExportacaoFolha.upsert({
        where: { tenant_id_sistema: { tenant_id: tenantId, sistema } },
        update: { codigo_empresa: codigoEmpresa, ativo: true },
        create: { tenant_id: tenantId, sistema, codigo_empresa: codigoEmpresa, ativo: true },
      })
    },

    // ── Mapeamento de eventos ────────────────────────────────────────────
    async listarMapeamento(tenantId: string, sistema: SistemaFolha) {
      return db.mapeamentoEventoFolha.findMany({
        where: { tenant_id: tenantId, sistema },
      })
    },

    async upsertMapeamento(
      tenantId: string,
      sistema: SistemaFolha,
      evento: EventoFolhaTipo,
      codigoExterno: string,
    ) {
      return db.mapeamentoEventoFolha.upsert({
        where: {
          tenant_id_sistema_evento: { tenant_id: tenantId, sistema, evento },
        },
        update: { codigo_externo: codigoExterno },
        create: { tenant_id: tenantId, sistema, evento, codigo_externo: codigoExterno },
      })
    },

    // ── Código de colaborador no sistema externo ──────────────────────────
    async upsertCodigoColaborador(
      colaboradorId: string,
      sistema: SistemaFolha,
      codigo: string,
    ) {
      return db.colaboradorCodigoFolha.upsert({
        where: {
          colaborador_id_sistema: { colaborador_id: colaboradorId, sistema },
        },
        update: { codigo },
        create: { colaborador_id: colaboradorId, sistema, codigo },
      })
    },

    async getCodigoColaborador(colaboradorId: string, sistema: SistemaFolha) {
      return db.colaboradorCodigoFolha.findUnique({
        where: { colaborador_id_sistema: { colaborador_id: colaboradorId, sistema } },
      })
    },

    async listarCodigosColaboradoresDoTenant(tenantId: string, sistema: SistemaFolha) {
      return db.colaboradorCodigoFolha.findMany({
        where: { sistema, colaborador: { tenant_id: tenantId } },
      })
    },

    // ── Log ──────────────────────────────────────────────────────────────
    async registrarExportacao(params: {
      tenantId: string
      sistema: SistemaFolha
      cnpjEstabId: string
      periodoId: string | null
      competenciaIni: Date
      competenciaFim: Date
      solicitanteId: string
      totalLinhas: number
      nomeArquivo: string
    }) {
      return db.exportacaoFolhaLog.create({
        data: {
          tenant_id: params.tenantId,
          sistema: params.sistema,
          cnpj_estab_id: params.cnpjEstabId,
          periodo_id: params.periodoId,
          competencia_ini: params.competenciaIni,
          competencia_fim: params.competenciaFim,
          solicitante_id: params.solicitanteId,
          total_linhas: params.totalLinhas,
          nome_arquivo: params.nomeArquivo,
        },
      })
    },

    async listarHistorico(tenantId: string, sistema: SistemaFolha) {
      return db.exportacaoFolhaLog.findMany({
        where: { tenant_id: tenantId, sistema },
        orderBy: { created_at: 'desc' },
        take: 50,
      })
    },
  }
}
