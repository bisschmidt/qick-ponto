import type { PrismaClient, TipoMarcacao } from '@prisma/client'

export function m9Service(db: PrismaClient) {
  return {
    // ── Motivos de ajuste ─────────────────────────────────────────────────────

    async listarMotivos(tenantId: string) {
      return db.motivoAjuste.findMany({
        where: { tenant_id: tenantId, ativo: true },
        orderBy: { descricao: 'asc' },
      })
    },

    async criarMotivo(tenantId: string, descricao: string, flagVa: boolean, flagVt: boolean) {
      return db.motivoAjuste.create({
        data: {
          tenant_id: tenantId,
          descricao,
          flag_desconto_va: flagVa,
          flag_desconto_vt: flagVt,
        },
      })
    },

    // ── Solicitações de ajuste ─────────────────────────────────────────────────

    async solicitarAjuste(params: {
      tenantId: string
      colaboradorId: string
      solicitanteId: string
      motivoId: string
      dataPonto: Date
      tipoAjuste: string
      justificativa: string
      novoTimestamp?: Date
      novoTipo?: TipoMarcacao
      marcacaoRefId?: string
    }) {
      return db.ajuste.create({
        data: {
          tenant_id: params.tenantId,
          colaborador_id: params.colaboradorId,
          solicitante_id: params.solicitanteId,
          motivo_id: params.motivoId,
          data_ponto: params.dataPonto,
          tipo_ajuste: params.tipoAjuste,
          justificativa: params.justificativa,
          novo_timestamp: params.novoTimestamp ?? null,
          novo_tipo: params.novoTipo ?? null,
          marcacao_ref_id: params.marcacaoRefId ?? null,
          status: 'PENDENTE_GESTOR',
        },
      })
    },

    // RH/Admin justifica uma falta diretamente (sem fluxo de aprovação)
    // Usado quando colaborador entrega atestado/justificativa em mãos
    async justificarFalta(params: {
      tenantId: string
      colaboradorId: string
      rhId: string
      motivoId: string
      dataPonto: Date
      justificativa: string
    }) {
      // Verifica se já existe ajuste aprovado para esse dia
      const existente = await db.ajuste.findFirst({
        where: {
          tenant_id: params.tenantId,
          colaborador_id: params.colaboradorId,
          data_ponto: params.dataPonto,
          status: 'APROVADO_RH',
        },
      })
      if (existente) {
        throw { statusCode: 409, message: 'Já existe ajuste aprovado para este dia' }
      }

      const now = new Date()
      return db.ajuste.create({
        data: {
          tenant_id: params.tenantId,
          colaborador_id: params.colaboradorId,
          solicitante_id: params.rhId,
          motivo_id: params.motivoId,
          data_ponto: params.dataPonto,
          tipo_ajuste: 'JUSTIFICATIVA_FALTA',
          justificativa: params.justificativa,
          status: 'APROVADO_RH',
          gestor_id: params.rhId,
          gestor_at: now,
          gestor_obs: 'Aprovado diretamente pelo RH',
          rh_id: params.rhId,
          rh_at: now,
          rh_obs: 'Justificativa lançada e aprovada pelo RH',
        },
      })
    },

    async listarAjustesPendentes(
      tenantId: string,
      etapa: 'GESTOR' | 'RH',
    ) {
      const status = etapa === 'GESTOR' ? 'PENDENTE_GESTOR' : 'PENDENTE_RH'
      return db.ajuste.findMany({
        where: { tenant_id: tenantId, status },
        include: {
          colaborador: { select: { id: true, nome_completo: true, matricula: true } },
          motivo: { select: { descricao: true } },
        },
        orderBy: { data_ponto: 'desc' },
      })
    },

    async buscarAjuste(tenantId: string, ajusteId: string) {
      return db.ajuste.findFirst({
        where: { id: ajusteId, tenant_id: tenantId },
        include: {
          colaborador: { select: { id: true, nome_completo: true, matricula: true } },
          motivo: true,
        },
      })
    },

    // ── Aprovação do Gestor ───────────────────────────────────────────────────

    async aprovarGestor(
      tenantId: string,
      ajusteId: string,
      gestorId: string,
      obs: string | null,
      encaminharRH: boolean,
    ) {
      const novoStatus = encaminharRH ? 'PENDENTE_RH' : 'APROVADO_GESTOR'

      const ajuste = await db.ajuste.update({
        where: { id: ajusteId, tenant_id: tenantId, status: 'PENDENTE_GESTOR' },
        data: {
          status: novoStatus,
          gestor_id: gestorId,
          gestor_obs: obs ?? null,
          gestor_at: new Date(),
        },
      })

      // Se aprovação final (sem RH), aplica a correção imediatamente
      if (!encaminharRH) {
        await this._aplicarCorrecao(tenantId, ajuste.id)
      }

      return ajuste
    },

    async reprovarGestor(
      tenantId: string,
      ajusteId: string,
      gestorId: string,
      obs: string,
    ) {
      return db.ajuste.update({
        where: { id: ajusteId, tenant_id: tenantId, status: 'PENDENTE_GESTOR' },
        data: {
          status: 'REPROVADO_GESTOR',
          gestor_id: gestorId,
          gestor_obs: obs,
          gestor_at: new Date(),
        },
      })
    },

    // ── Aprovação do RH ───────────────────────────────────────────────────────

    async aprovarRH(
      tenantId: string,
      ajusteId: string,
      rhId: string,
      obs: string | null,
    ) {
      const ajuste = await db.ajuste.update({
        where: { id: ajusteId, tenant_id: tenantId, status: 'PENDENTE_RH' },
        data: {
          status: 'APROVADO_RH',
          rh_id: rhId,
          rh_obs: obs ?? null,
          rh_at: new Date(),
        },
      })

      await this._aplicarCorrecao(tenantId, ajuste.id)
      return ajuste
    },

    async reprovarRH(
      tenantId: string,
      ajusteId: string,
      rhId: string,
      obs: string,
    ) {
      return db.ajuste.update({
        where: { id: ajusteId, tenant_id: tenantId, status: 'PENDENTE_RH' },
        data: {
          status: 'REPROVADO_RH',
          rh_id: rhId,
          rh_obs: obs,
          rh_at: new Date(),
        },
      })
    },

    // ── Aplicação da correção (interno) ───────────────────────────────────────

    async _aplicarCorrecao(tenantId: string, ajusteId: string) {
      const ajuste = await db.ajuste.findUniqueOrThrow({
        where: { id: ajusteId },
        include: { colaborador: { include: { cnpj_estab: true } } },
      })

      // Só cria nova marcação se há um novo horário definido
      if (!ajuste.novo_timestamp || !ajuste.novo_tipo) return

      // Busca NSR do CNPJ para a nova marcação corretiva
      const cnpjEstab = ajuste.colaborador.cnpj_estab

      const [{ nsr }] = await db.$queryRaw<[{ nsr: bigint }]>`
        UPDATE "CnpjEstabelecimento"
        SET nsr_contador = nsr_contador + 1
        WHERE id = ${cnpjEstab.id}::uuid
        RETURNING nsr_contador AS nsr
      `

      await db.marcacao.create({
        data: {
          tenant_id: tenantId,
          cnpj_estab_id: cnpjEstab.id,
          colaborador_id: ajuste.colaborador_id,
          nsr,
          timestamp_marcacao: ajuste.novo_timestamp,
          timestamp_gravacao: new Date(),
          tipo: ajuste.novo_tipo,
          canal: 'WEB',
          hash_sha256: ajusteId, // hash real seria SHA-256 dos campos — ajuste usa o ID como ref
          fora_da_area: false,
          fora_da_janela: false,
        },
      })
    },

    // ── Manutenção em lote ────────────────────────────────────────────────────

    async processarLoteRH(
      tenantId: string,
      ajusteIds: string[],
      rhId: string,
      acao: 'APROVAR' | 'REPROVAR',
      obs: string,
    ) {
      const resultados = []
      for (const id of ajusteIds) {
        try {
          const resultado = acao === 'APROVAR'
            ? await this.aprovarRH(tenantId, id, rhId, obs)
            : await this.reprovarRH(tenantId, id, rhId, obs)
          resultados.push({ id, ok: true, status: resultado.status })
        } catch (err) {
          resultados.push({ id, ok: false, erro: err instanceof Error ? err.message : 'Erro' })
        }
      }
      return resultados
    },
  }
}
