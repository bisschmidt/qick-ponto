import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { m6Service } from './service.js'

const criarPeriodoSchema = z.object({
  data_inicio: z.string().date(),
  data_fim: z.string().date(),
})

const fecharPeriodoSchema = z.object({
  cnpj_estab_id: z.string().uuid(),
})

const assinarSchema = z.object({
  espelho_id: z.string().uuid(),
})

export async function m6Router(app: FastifyInstance) {
  const service = m6Service(app.db)

  const authRH = {
    preHandler: [app.authenticate, app.requireRole(['ADMIN_TENANT', 'RH_DP'])],
  }

  // POST /v1/periodo — criar período de fechamento
  app.post('/periodo', authRH, async (req, reply) => {
    const body = criarPeriodoSchema.parse(req.body)
    const periodo = await service.criarPeriodo(
      req.jwtPayload.tenantId,
      new Date(body.data_inicio),
      new Date(body.data_fim),
    )
    return reply.status(201).send(periodo)
  })

  // GET /v1/periodo — listar períodos
  app.get('/periodo', {
    preHandler: [app.authenticate, app.requireRole(['ADMIN_TENANT', 'RH_DP', 'AUDITOR'])],
  }, async (req, reply) => {
    return reply.send(await service.listarPeriodos(req.jwtPayload.tenantId))
  })

  // GET /v1/periodo/:id — detalhes do período
  app.get('/periodo/:id', {
    preHandler: [app.authenticate, app.requireRole(['ADMIN_TENANT', 'RH_DP', 'AUDITOR'])],
  }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const periodo = await service.buscarPeriodo(req.jwtPayload.tenantId, id)
    if (!periodo) return reply.status(404).send({ error: 'Período não encontrado' })
    return reply.send(periodo)
  })

  // POST /v1/periodo/:id/fechar — fechar período (irreversível)
  app.post('/periodo/:id/fechar', authRH, async (req, reply) => {
    const { id } = req.params as { id: string }
    const body = fecharPeriodoSchema.parse(req.body)
    const resultado = await service.fecharPeriodo(
      req.jwtPayload.tenantId,
      id,
      body.cnpj_estab_id,
      req.jwtPayload.sub,
    )
    return reply.send(resultado)
  })

  // GET /v1/espelho/:id/pdf — baixar PDF do espelho
  app.get('/espelho/:id/pdf', {
    preHandler: [
      app.authenticate,
      app.requireRole(['ADMIN_TENANT', 'RH_DP', 'COLABORADOR', 'AUDITOR']),
    ],
  }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const pdf = await service.gerarPdfEspelho(req.jwtPayload.tenantId, id)
    return reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `inline; filename="espelho-${id}.pdf"`)
      .send(pdf)
  })

  // POST /v1/espelho/:id/assinar — colaborador assina seu espelho
  app.post('/espelho/:id/assinar', {
    preHandler: [app.authenticate, app.requireRole(['COLABORADOR', 'ADMIN_TENANT', 'RH_DP'])],
  }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const ip = req.ip
    const resultado = await service.assinarEspelho(req.jwtPayload.tenantId, id, ip, req.jwtPayload.sub)
    return reply.send(resultado)
  })

  // POST /v1/espelho/:id/nao-manifestado — marcar como não manifestado (gestor/RH)
  app.post('/espelho/:id/nao-manifestado', authRH, async (req, reply) => {
    const { id } = req.params as { id: string }
    const resultado = await service.marcarNaoManifestado(req.jwtPayload.tenantId, id)
    return reply.send(resultado)
  })

  // GET /v1/espelhos/meus — espelhos do colaborador logado
  app.get('/espelhos/meus', {
    preHandler: [app.authenticate],
  }, async (req) => {
    const espelhos = await app.db.espelhoPonto.findMany({
      where: {
        tenant_id: req.jwtPayload.tenantId,
        colaborador_id: req.jwtPayload.sub,
      },
      include: { periodo: { select: { data_inicio: true, data_fim: true } } },
      orderBy: { created_at: 'desc' },
    })
    return espelhos.map((e) => ({
      id: e.id,
      status: e.nao_manifestado ? 'NAO_MANIFESTADO' : e.assinado ? 'ASSINADO_COLAB' : 'PENDENTE',
      assinado_at: e.assinado_at,
      periodo: e.periodo,
    }))
  })

  // GET /v1/espelho/:id — dados do espelho
  app.get('/espelho/:id', {
    preHandler: [
      app.authenticate,
      app.requireRole(['ADMIN_TENANT', 'RH_DP', 'COLABORADOR', 'AUDITOR']),
    ],
  }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const espelho = await service.buscarEspelho(req.jwtPayload.tenantId, id)
    if (!espelho) return reply.status(404).send({ error: 'Espelho não encontrado' })
    return reply.send(espelho)
  })
}
