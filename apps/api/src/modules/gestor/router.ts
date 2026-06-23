import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { gestorService } from './service.js'

export async function gestorRouter(app: FastifyInstance) {
  const service = gestorService(app.db)

  const authGestor = {
    preHandler: [
      app.authenticate,
      app.requireRole(['ADMIN_TENANT', 'RH_DP', 'GESTOR', 'AUDITOR']),
    ],
  }
  const authAdmin = {
    preHandler: [app.authenticate, app.requireRole(['ADMIN_TENANT', 'RH_DP'])],
  }

  app.get('/gestor/meu-time', authGestor, async (req) => {
    return service.meuTime(req.jwtPayload.tenantId, req.jwtPayload.sub, req.jwtPayload.role)
  })

  app.get('/gestor/time-no-dia', authGestor, async (req) => {
    const { data } = z.object({ data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse(req.query)
    return service.timeNoDia(req.jwtPayload.tenantId, req.jwtPayload.sub, req.jwtPayload.role, data)
  })

  app.get('/gestor/ficha-subordinado', authGestor, async (req) => {
    const q = z.object({
      colaborador_id: z.string().uuid(),
      mes: z.string().regex(/^\d{4}-\d{2}$/),
    }).parse(req.query)
    return service.fichaSubordinado(
      req.jwtPayload.tenantId,
      req.jwtPayload.sub,
      req.jwtPayload.role,
      q.colaborador_id,
      q.mes,
    )
  })

  app.get('/gestor/pendencias', authGestor, async (req) => {
    return service.pendenciasDoTime(req.jwtPayload.tenantId, req.jwtPayload.sub, req.jwtPayload.role)
  })

  app.post('/gestor/criar-ajuste', authGestor, async (req, reply) => {
    const b = z.object({
      colaborador_id: z.string().uuid(),
      motivo_id: z.string().uuid(),
      data_ponto: z.string().date(),
      tipo_ajuste: z.string().min(1).max(50),
      justificativa: z.string().min(3).max(500),
      novo_timestamp: z.string().datetime().optional(),
      novo_tipo: z.string().optional(),
    }).parse(req.body)
    const params: Parameters<typeof service.criarAjustePeloGestor>[0] = {
      tenantId: req.jwtPayload.tenantId,
      gestorId: req.jwtPayload.sub,
      role: req.jwtPayload.role,
      colaboradorId: b.colaborador_id,
      motivoId: b.motivo_id,
      dataPonto: new Date(b.data_ponto),
      tipoAjuste: b.tipo_ajuste,
      justificativa: b.justificativa,
    }
    if (b.novo_timestamp) params.novoTimestamp = new Date(b.novo_timestamp)
    if (b.novo_tipo) params.novoTipo = b.novo_tipo
    const r = await service.criarAjustePeloGestor(params)
    return reply.status(201).send(r)
  })

  app.get('/gestor/alertas-equipe', authGestor, async (req) => {
    return service.alertasEquipe(req.jwtPayload.tenantId, req.jwtPayload.sub, req.jwtPayload.role)
  })

  app.post('/gestor/marcar-saida-antecipada', authAdmin, async (req, reply) => {
    const b = z.object({
      colaborador_id: z.string().uuid(),
      data_ponto: z.string().date(),
      justificativa: z.string().min(3).max(500),
    }).parse(req.body)
    const r = await service.marcarSaidaAntecipada({
      tenantId: req.jwtPayload.tenantId,
      gestorId: req.jwtPayload.sub,
      role: req.jwtPayload.role,
      colaboradorId: b.colaborador_id,
      dataPonto: new Date(b.data_ponto),
      justificativa: b.justificativa,
    })
    return reply.status(201).send(r)
  })

  app.post('/ajustes/:id/pedir-comprovacao', authGestor, async (req) => {
    const { id } = req.params as { id: string }
    const { obs } = z.object({ obs: z.string().min(1).max(300) }).parse(req.body)
    return service.pedirComprovacao(req.jwtPayload.tenantId, req.jwtPayload.sub, id, obs)
  })

  app.post('/colaboradores/:id/gestor', authAdmin, async (req) => {
    const { id } = req.params as { id: string }
    const { gestor_id } = z.object({ gestor_id: z.string().uuid().nullable() }).parse(req.body)
    return service.definirGestor(req.jwtPayload.tenantId, id, gestor_id)
  })
}
