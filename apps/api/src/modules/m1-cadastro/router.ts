import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { m1Repository } from './repository.js'
import { m1Service } from './service.js'
import {
  criarColaboradorSchema,
  editarColaboradorSchema,
  criarJornadaSchema,
  criarActSchema,
} from './schema.js'

export async function m1Router(app: FastifyInstance) {
  const service = m1Service(m1Repository(app.db))

  const authGestor = {
    preHandler: [app.authenticate, app.requireRole(['ADMIN_TENANT', 'GESTOR', 'RH_DP'])],
  }
  const authAdmin = {
    preHandler: [app.authenticate, app.requireRole(['ADMIN_TENANT'])],
  }
  const authRH = {
    preHandler: [app.authenticate, app.requireRole(['ADMIN_TENANT', 'RH_DP'])],
  }

  // ── Colaboradores ───────────────────────────────────────────────────────────

  app.post('/colaboradores', authAdmin, async (req, reply) => {
    const input = criarColaboradorSchema.parse(req.body)
    const colaborador = await service.criarColaborador(
      req.jwtPayload.tenantId,
      req.jwtPayload.sub,
      input,
    )
    return reply.status(201).send(colaborador)
  })

  app.get('/colaboradores', authGestor, async (req) => {
    const { cnpj_estab_id } = req.query as { cnpj_estab_id?: string }
    return service.listarColaboradores(req.jwtPayload.tenantId, cnpj_estab_id)
  })

  app.get('/colaboradores/:id', authGestor, async (req) => {
    const { id } = req.params as { id: string }
    return service.buscarColaborador(req.jwtPayload.tenantId, id)
  })

  app.patch('/colaboradores/:id', authAdmin, async (req, reply) => {
    const { id } = req.params as { id: string }
    const input = editarColaboradorSchema.parse(req.body)
    const colaborador = await service.editarColaborador(
      req.jwtPayload.tenantId,
      id,
      req.jwtPayload.sub,
      input,
    )
    return reply.send(colaborador)
  })

  // Definir/redefinir senha do colaborador (admin)
  app.post('/colaboradores/:id/senha', authAdmin, async (req, reply) => {
    const { id } = req.params as { id: string }
    const { senha } = req.body as { senha: string }
    if (!senha || senha.length < 6) {
      return reply.status(400).send({ error: 'Senha deve ter pelo menos 6 caracteres' })
    }
    await service.definirSenha(req.jwtPayload.tenantId, id, senha)
    return reply.send({ ok: true })
  })

  // Reenviar convite de onboarding por email
  app.post('/colaboradores/:id/reenviar-convite', authAdmin, async (req, reply) => {
    const { id } = req.params as { id: string }
    await service.reenviarConvite(req.jwtPayload.tenantId, id)
    return reply.send({ ok: true })
  })

  // Registrar aceite LGPD pelo admin (aceite presencial ou por outro canal)
  app.post('/colaboradores/:id/aceite-lgpd', authAdmin, async (req, reply) => {
    const { id } = req.params as { id: string }
    await service.registrarAceiteLgpd(req.jwtPayload.tenantId, id, req.ip)
    return reply.send({ ok: true })
  })

  // ── Desligamento (RH) ───────────────────────────────────────────────────────
  app.post('/colaboradores/:id/desligar', authRH, async (req, reply) => {
    const { id } = req.params as { id: string }
    const { data_desligamento } = z
      .object({ data_desligamento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) })
      .parse(req.body)
    const colab = await app.db.colaborador.findFirst({
      where: { id, tenant_id: req.jwtPayload.tenantId },
    })
    if (!colab) return reply.status(404).send({ message: 'Colaborador não encontrado' })
    if (!colab.ativo) return reply.status(409).send({ message: 'Colaborador já desligado' })

    const atualizado = await app.db.colaborador.update({
      where: { id },
      data: {
        ativo: false,
        data_desligamento: new Date(`${data_desligamento}T00:00:00Z`),
      },
    })

    // Encerra a jornada vigente
    await app.db.colaboradorJornada.updateMany({
      where: { colaborador_id: id, data_fim: null },
      data: { data_fim: new Date(`${data_desligamento}T00:00:00Z`) },
    })

    // Desativa o usuário (login)
    await app.db.usuario.updateMany({
      where: { colaborador_id: id },
      data: { ativo: false },
    })

    return reply.send(atualizado)
  })

  app.post('/colaboradores/:id/reativar', authRH, async (req, reply) => {
    const { id } = req.params as { id: string }
    const colab = await app.db.colaborador.findFirst({
      where: { id, tenant_id: req.jwtPayload.tenantId },
    })
    if (!colab) return reply.status(404).send({ message: 'Colaborador não encontrado' })

    const atualizado = await app.db.colaborador.update({
      where: { id },
      data: { ativo: true, data_desligamento: null },
    })
    await app.db.usuario.updateMany({
      where: { colaborador_id: id },
      data: { ativo: true },
    })
    return reply.send(atualizado)
  })

  // ── Jornadas ────────────────────────────────────────────────────────────────

  app.post('/jornadas', authAdmin, async (req, reply) => {
    const input = criarJornadaSchema.parse(req.body)
    const jornada = await service.criarJornada(req.jwtPayload.tenantId, input)
    return reply.status(201).send(jornada)
  })

  app.get('/jornadas', authGestor, async (req) => {
    return service.listarJornadas(req.jwtPayload.tenantId)
  })

  app.get('/jornadas/:id', authGestor, async (req, reply) => {
    const { id } = req.params as { id: string }
    const j = await app.db.jornada.findFirst({
      where: { id, tenant_id: req.jwtPayload.tenantId },
      include: { pausas: { orderBy: { ordem: 'asc' } } },
    })
    if (!j) return reply.status(404).send({ message: 'Jornada não encontrada' })
    return reply.send(j)
  })

  app.put('/jornadas/:id', authAdmin, async (req, reply) => {
    const { id } = req.params as { id: string }
    const input = criarJornadaSchema.parse(req.body)
    const existe = await app.db.jornada.findFirst({
      where: { id, tenant_id: req.jwtPayload.tenantId },
    })
    if (!existe) return reply.status(404).send({ message: 'Jornada não encontrada' })

    // Atualiza dados base
    const jornada = await app.db.jornada.update({
      where: { id },
      data: {
        nome: input.nome,
        tipo: input.tipo,
        hora_inicio: input.hora_inicio,
        hora_fim: input.hora_fim,
        dias_semana: input.dias_semana,
        tolerancia_atraso_entrada: input.tolerancia_atraso_entrada,
        tolerancia_atraso_intervalo: input.tolerancia_atraso_intervalo,
        tolerancia_antec_saida: input.tolerancia_antec_saida,
        tolerancia_antec_inicio_interv: input.tolerancia_antec_inicio_interv,
        janela_marcacao_min: input.janela_marcacao_min,
      },
    })

    // Substitui pausas (delete + recreate)
    await app.db.pausaConfig.deleteMany({ where: { jornada_id: id } })
    if (input.pausas && input.pausas.length > 0) {
      await app.db.pausaConfig.createMany({
        data: input.pausas.map((p) => ({
          jornada_id: id,
          nome: p.nome,
          ordem: p.ordem,
          duracao_min: p.duracao_min,
          eh_nr17: p.eh_nr17,
          eh_intervalo_refeicao: p.eh_intervalo_refeicao,
          computa_jornada: p.computa_jornada,
          janela_inicio_min: p.janela_inicio_min ?? null,
          janela_fim_min: p.janela_fim_min ?? null,
        })),
      })
    }

    return reply.send(jornada)
  })

  // ── CNPJs do tenant ─────────────────────────────────────────────────────────

  app.get('/cnpjs', authGestor, async (req) => {
    return app.db.cnpjEstabelecimento.findMany({
      where: { tenant_id: req.jwtPayload.tenantId, ativo: true },
      select: { id: true, cnpj: true, razao_social: true, uf: true },
      orderBy: { razao_social: 'asc' },
    })
  })

  // ── Tenant ──────────────────────────────────────────────────────────────────

  app.get('/tenant', authAdmin, async (req) => {
    return app.db.tenant.findUniqueOrThrow({
      where: { id: req.jwtPayload.tenantId },
      select: { id: true, razao_social: true, plano: true, ip_whitelist: true, ativo: true, created_at: true },
    })
  })

  app.put('/tenant/ips', authAdmin, async (req, reply) => {
    const { ips } = req.body as { ips: string[] }
    const tenant = await app.db.tenant.update({
      where: { id: req.jwtPayload.tenantId },
      data: { ip_whitelist: ips },
      select: { id: true, ip_whitelist: true },
    })
    return reply.send(tenant)
  })

  // ── ACT ─────────────────────────────────────────────────────────────────────

  app.post('/acts', authAdmin, async (req, reply) => {
    const input = criarActSchema.parse(req.body)
    const act = await service.criarAct(req.jwtPayload.tenantId, input)
    return reply.status(201).send(act)
  })
}
