import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { m2Service } from './service.js'
import { portalService } from './portal-service.js'
import { registrarMarcacaoSchema, aceiteLgpdSchema } from './schema.js'

export async function m2Router(app: FastifyInstance) {
  const service = m2Service(app.db, app.redisUrl)
  const portal = portalService(app.db)

  const authColab = {
    preHandler: [app.authenticate],
  }

  // ── Onboarding LGPD ─────────────────────────────────────────────────────────
  // Aceite obrigatório antes da primeira marcação
  app.post('/onboarding/aceite-lgpd', authColab, async (req, reply) => {
    const input = aceiteLgpdSchema.parse(req.body)
    const result = await service.registrarAceiteLgpd(
      req.jwtPayload.sub,
      req.jwtPayload.tenantId,
      input,
    )
    return reply.status(201).send(result)
  })

  // ── Próximo evento esperado ──────────────────────────────────────────────────
  app.get('/marcacoes/proximo-evento', authColab, async (req) => {
    return service.proximoEvento(req.jwtPayload.sub, req.jwtPayload.tenantId)
  })

  // ── Portal do colaborador: ficha ponto mensal ───────────────────────────────
  app.get('/ponto/minha-ficha', authColab, async (req) => {
    const { mes } = z.object({ mes: z.string().regex(/^\d{4}-\d{2}$/) }).parse(req.query)
    return portal.minhaFicha(req.jwtPayload.sub, req.jwtPayload.tenantId, mes)
  })

  // ── Portal: minhas solicitações de ajuste ───────────────────────────────────
  app.get('/ponto/minhas-solicitacoes', authColab, async (req) => {
    return portal.minhasSolicitacoes(req.jwtPayload.sub, req.jwtPayload.tenantId)
  })

  // ── Registrar marcação ───────────────────────────────────────────────────────
  app.post('/marcacoes', authColab, async (req, reply) => {
    const input = registrarMarcacaoSchema.parse(req.body)
    const result = await service.registrarMarcacao(
      req.jwtPayload.sub,
      req.jwtPayload.tenantId,
      input,
    )
    return reply.status(201).send(result)
  })
}
