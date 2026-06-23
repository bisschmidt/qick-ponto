import type { FastifyInstance } from 'fastify'
import { heService } from './service.js'
import { configHeService } from './config-service.js'
import { marcacaoHe } from './marcacao-he.js'
import {
  lancarHeSchema,
  ajustarHeSchema,
  solicitarCompensacaoSchema,
  alterarCompensacaoSchema,
  jornadaDoDiaQuerySchema,
  obsSchema,
  configHeSchema,
  baterHeSchema,
} from './schema.js'

export async function heRouter(app: FastifyInstance) {
  const service = heService(app.db)
  const config = configHeService(app.db)
  const bater = marcacaoHe(app.db, app.redisUrl)

  const authGestor = {
    preHandler: [app.authenticate, app.requireRole(['ADMIN_TENANT', 'RH_DP', 'GESTOR'])],
  }
  const authAdmin = {
    preHandler: [app.authenticate, app.requireRole(['ADMIN_TENANT', 'RH_DP'])],
  }
  const authColab = {
    preHandler: [app.authenticate, app.requireRole(['COLABORADOR'])],
  }

  // ── Config (admin) ──────────────────────────────────────────────────────
  app.get('/he/config', authAdmin, async (req) => {
    return config.obter(req.jwtPayload.tenantId)
  })

  app.put('/he/config', authAdmin, async (req) => {
    const b = configHeSchema.parse(req.body)
    return config.atualizar(req.jwtPayload.tenantId, b)
  })

  // ── Gestão (gestor/RH) ──────────────────────────────────────────────────
  app.get('/he/time', authGestor, async (req) => {
    await service.reconciliarPendentes(req.jwtPayload.tenantId, req.jwtPayload.sub, req.jwtPayload.role)
    return service.listarHeDoTime(req.jwtPayload.tenantId, req.jwtPayload.sub, req.jwtPayload.role)
  })

  app.get('/he/relatorio-falta', authGestor, async (req) => {
    return service.relatorioFaltaHe(req.jwtPayload.tenantId, req.jwtPayload.sub, req.jwtPayload.role)
  })

  app.post('/he/planejada', authGestor, async (req, reply) => {
    const b = lancarHeSchema.parse(req.body)
    const r = await service.lancarHePlanejada({
      tenantId: req.jwtPayload.tenantId,
      gestorId: req.jwtPayload.sub,
      role: req.jwtPayload.role,
      colaboradorId: b.colaborador_id,
      data: b.data,
      horaInicio: b.hora_inicio,
      horaFim: b.hora_fim,
      tipo: b.tipo,
      ...(b.motivo ? { motivo: b.motivo } : {}),
    })
    return reply.status(201).send(r)
  })

  app.post('/he/:id/ajustar', authGestor, async (req) => {
    const { id } = req.params as { id: string }
    const b = ajustarHeSchema.parse(req.body)
    return service.ajustarHe(req.jwtPayload.tenantId, req.jwtPayload.sub, req.jwtPayload.role, id, {
      ...(b.data ? { data: b.data } : {}),
      horaInicio: b.hora_inicio,
      horaFim: b.hora_fim,
    })
  })

  app.post('/he/:id/cancelar', authGestor, async (req) => {
    const { id } = req.params as { id: string }
    return service.cancelarHe(req.jwtPayload.tenantId, req.jwtPayload.sub, req.jwtPayload.role, id)
  })

  app.post('/he/compensacoes/:id/aprovar', authGestor, async (req) => {
    const { id } = req.params as { id: string }
    return service.aprovarCompensacao(req.jwtPayload.tenantId, req.jwtPayload.sub, req.jwtPayload.role, id)
  })

  app.post('/he/compensacoes/:id/reprovar', authGestor, async (req) => {
    const { id } = req.params as { id: string }
    const { obs } = obsSchema.parse(req.body)
    return service.reprovarCompensacao(req.jwtPayload.tenantId, req.jwtPayload.sub, req.jwtPayload.role, id, obs)
  })

  app.post('/he/compensacoes/:id/alterar', authGestor, async (req) => {
    const { id } = req.params as { id: string }
    const b = alterarCompensacaoSchema.parse(req.body)
    return service.alterarCompensacao(req.jwtPayload.tenantId, req.jwtPayload.sub, req.jwtPayload.role, id, b.dias)
  })

  // ── Colaborador ─────────────────────────────────────────────────────────
  app.get('/he/minhas', authColab, async (req) => {
    const [hes, compensacoes] = await Promise.all([
      service.listarMinhasHe(req.jwtPayload.sub, req.jwtPayload.tenantId),
      service.listarMinhasCompensacoes(req.jwtPayload.sub, req.jwtPayload.tenantId),
    ])
    return { hes, compensacoes }
  })

  app.get('/he/jornada-do-dia', authColab, async (req) => {
    const { data } = jornadaDoDiaQuerySchema.parse(req.query)
    return service.infoCompensacaoData(req.jwtPayload.tenantId, req.jwtPayload.sub, data)
  })

  app.post('/he/:id/aceitar', authColab, async (req) => {
    const { id } = req.params as { id: string }
    return service.aceitarHe(req.jwtPayload.sub, req.jwtPayload.tenantId, id)
  })

  app.post('/he/:id/recusar', authColab, async (req) => {
    const { id } = req.params as { id: string }
    return service.recusarHe(req.jwtPayload.sub, req.jwtPayload.tenantId, id)
  })

  app.post('/he/compensacao', authColab, async (req, reply) => {
    const b = solicitarCompensacaoSchema.parse(req.body)
    const r = await service.solicitarCompensacao({
      tenantId: req.jwtPayload.tenantId,
      colaboradorId: req.jwtPayload.sub,
      dataFalta: b.data_falta,
      motivo: b.motivo,
      dias: b.dias,
    })
    return reply.status(201).send(r)
  })

  app.post('/he/bater', authColab, async (req, reply) => {
    const b = baterHeSchema.parse(req.body ?? {})
    const r = await bater.baterHe(req.jwtPayload.sub, req.jwtPayload.tenantId, b)
    return reply.status(201).send(r)
  })
}
