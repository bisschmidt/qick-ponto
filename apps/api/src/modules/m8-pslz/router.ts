import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { m8Service } from './service.js'

const configurarSchema = z.object({
  endpoint_url: z.string().url(),
  api_key: z.string().min(1),
  webhook_secret: z.string().min(16),
})

const enviarSchema = z.object({
  periodo_id: z.string().uuid(),
  cnpj_estab_id: z.string().uuid(),
})

export async function m8Router(app: FastifyInstance) {
  const service = m8Service(app.db)

  const authAdmin = {
    preHandler: [app.authenticate, app.requireRole(['ADMIN_TENANT'])],
  }

  // PUT /v1/pslz/config — configurar integração
  app.put('/pslz/config', authAdmin, async (req, reply) => {
    const body = configurarSchema.parse(req.body)
    const config = await service.configurarIntegracao(
      req.jwtPayload.tenantId,
      body.endpoint_url,
      body.api_key,
      body.webhook_secret,
    )
    return reply.send({ ok: true, id: config.id })
  })

  // POST /v1/pslz/enviar — disparar envio manual de eventos de folha
  app.post('/pslz/enviar', {
    preHandler: [app.authenticate, app.requireRole(['ADMIN_TENANT', 'RH_DP'])],
  }, async (req, reply) => {
    const body = enviarSchema.parse(req.body)
    const resultado = await service.enviarEventosFolha(
      req.jwtPayload.tenantId,
      body.periodo_id,
      body.cnpj_estab_id,
    )
    return reply.send(resultado)
  })

  // POST /v1/pslz/webhook/:tenant_id — endpoint recebendo eventos da PSLZ (sem JWT)
  // A autenticação é feita por assinatura HMAC-SHA256 no header X-PSLZ-Signature
  app.post('/pslz/webhook/:tenant_id', {
    config: { rawBody: true },
  }, async (req, reply) => {
    const { tenant_id } = req.params as { tenant_id: string }
    const assinatura = (req.headers['x-pslz-signature'] as string | undefined) ?? ''

    // Usar o body bruto para validar a assinatura
    const rawBody = (req as unknown as { rawBody?: string }).rawBody ?? JSON.stringify(req.body)

    try {
      const resultado = await service.processarEventoEntrada(tenant_id, rawBody, assinatura)
      return reply.send(resultado)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro'
      return reply.status(401).send({ error: msg })
    }
  })

  // GET /v1/pslz/logs — histórico de eventos
  app.get('/pslz/logs', {
    preHandler: [app.authenticate, app.requireRole(['ADMIN_TENANT', 'RH_DP', 'AUDITOR'])],
  }, async (req, reply) => {
    const logs = await service.listarLogs(req.jwtPayload.tenantId)
    return reply.send(logs)
  })
}
