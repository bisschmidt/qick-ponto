import type { PrismaClient, Prisma } from '@prisma/client'

export function m1Repository(db: PrismaClient) {
  return {
    // ── Colaboradores ─────────────────────────────────────────────────────────

    findColaboradorByCpf(tenantId: string, cpf: string) {
      return db.colaborador.findUnique({
        where: { tenant_id_cpf: { tenant_id: tenantId, cpf } },
      })
    },

    createColaborador(data: Prisma.ColaboradorCreateInput) {
      return db.colaborador.create({ data })
    },

    createColaboradorJornada(data: Prisma.ColaboradorJornadaCreateInput) {
      return db.colaboradorJornada.create({ data })
    },

    updateColaborador(id: string, data: Prisma.ColaboradorUpdateInput) {
      return db.colaborador.update({ where: { id }, data })
    },

    encerrarColaboradorJornada(id: string, dataFim: Date) {
      return db.colaboradorJornada.update({ where: { id }, data: { data_fim: dataFim } })
    },

    findColaboradoresByTenant(tenantId: string, cnpjEstabId?: string) {
      return db.colaborador.findMany({
        where: {
          tenant_id: tenantId,
          ...(cnpjEstabId ? { cnpj_estab_id: cnpjEstabId } : {}),
          ativo: true,
        },
        include: { cnpj_estab: true },
        orderBy: { nome_completo: 'asc' },
      })
    },

    findColaboradorById(tenantId: string, id: string) {
      return db.colaborador.findFirst({
        where: { id, tenant_id: tenantId },
        include: {
          jornadas: {
            where: { data_fim: null },
            include: { jornada: { include: { pausas: true } } },
            take: 1,
          },
          aceite_lgpd: true,
          codigos_folha: true,
          cnpj_estab: { select: { id: true, cnpj: true, razao_social: true, uf: true } },
          usuario: { select: { perfil: true } },
        },
      })
    },

    findMarcacoesByColaborador(tenantId: string, colaboradorId: string, limite: number) {
      return db.marcacao.findMany({
        where: { tenant_id: tenantId, colaborador_id: colaboradorId },
        orderBy: { timestamp_marcacao: 'desc' },
        take: limite,
        select: {
          id: true,
          nsr: true,
          tipo: true,
          canal: true,
          timestamp_marcacao: true,
          fora_da_area: true,
          fora_da_janela: true,
          ajustes: {
            select: {
              id: true,
              tipo_ajuste: true,
              status: true,
              justificativa: true,
              novo_timestamp: true,
              novo_tipo: true,
              created_at: true,
            },
          },
        },
      })
    },

    createUsuario(data: Prisma.UsuarioCreateInput) {
      return db.usuario.create({ data })
    },

    findUsuarioByColaboradorId(colaboradorId: string) {
      return db.usuario.findFirst({ where: { colaborador_id: colaboradorId } })
    },

    updateUsuarioSenha(usuarioId: string, senhaHash: string) {
      return db.usuario.update({ where: { id: usuarioId }, data: { senha_hash: senhaHash } })
    },

    updateUsuarioOnboardingToken(usuarioId: string, token: string, expires: Date) {
      return db.usuario.update({
        where: { id: usuarioId },
        data: { onboarding_token: token, onboarding_token_expires: expires },
      })
    },

    upsertAceiteLgpd(colaboradorId: string, ip: string) {
      return db.aceiteLgpd.upsert({
        where: { colaborador_id: colaboradorId },
        create: {
          colaborador_id: colaboradorId,
          timestamp_aceite: new Date(),
          ip,
          versao_aviso: '1.0',
        },
        update: {
          timestamp_aceite: new Date(),
          ip,
          versao_aviso: '1.0',
        },
      })
    },

    setOnboardingOk(colaboradorId: string) {
      return db.colaborador.update({ where: { id: colaboradorId }, data: { onboarding_ok: true } })
    },

    // ── Jornadas ──────────────────────────────────────────────────────────────

    createJornada(data: Prisma.JornadaCreateInput) {
      return db.jornada.create({ data })
    },

    // Apenas ativas — usado para vincular colaboradores (novos vínculos)
    findJornadasByTenant(tenantId: string) {
      return db.jornada.findMany({
        where: { tenant_id: tenantId, ativo: true },
        include: { pausas: { orderBy: { ordem: 'asc' } }, horarios: true },
      })
    },

    // Todas (ativas + inativas) com contagem de vínculos — usado na gestão de jornadas
    findJornadasGestao(tenantId: string) {
      return db.jornada.findMany({
        where: { tenant_id: tenantId },
        include: {
          pausas: { orderBy: { ordem: 'asc' } },
          horarios: true,
          _count: { select: { colaboradores: true } },
        },
        orderBy: [{ ativo: 'desc' }, { nome: 'asc' }],
      })
    },

    findJornadaById(tenantId: string, id: string) {
      return db.jornada.findFirst({
        where: { id, tenant_id: tenantId },
        include: { pausas: { orderBy: { ordem: 'asc' } }, horarios: true },
      })
    },

    contarVinculosJornada(id: string) {
      return db.colaboradorJornada.count({ where: { jornada_id: id } })
    },

    setJornadaAtivo(id: string, ativo: boolean) {
      return db.jornada.update({ where: { id }, data: { ativo } })
    },

    deleteJornada(id: string) {
      return db.jornada.delete({ where: { id } })
    },

    // ── ACT ───────────────────────────────────────────────────────────────────

    createAct(data: Prisma.ActCreateInput) {
      return db.act.create({ data })
    },

    findActVigeante(tenantId: string, data: Date) {
      return db.act.findFirst({
        where: {
          tenant_id: tenantId,
          ativo: true,
          data_inicio: { lte: data },
          data_fim: { gte: data },
        },
        orderBy: { data_inicio: 'desc' },
      })
    },

    // ── CNPJ Estabelecimentos ─────────────────────────────────────────────────

    findCnpjEstabById(tenantId: string, id: string) {
      return db.cnpjEstabelecimento.findFirst({
        where: { id, tenant_id: tenantId, ativo: true },
      })
    },

    findCnpjEstabsByTenant(tenantId: string) {
      return db.cnpjEstabelecimento.findMany({
        where: { tenant_id: tenantId, ativo: true },
      })
    },
  }
}

export type M1Repository = ReturnType<typeof m1Repository>
