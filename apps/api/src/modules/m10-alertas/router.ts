import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { m10Service } from './service.js'

const periodoSchema = z.object({
  data_inicio: z.string().date(),
  data_fim: z.string().date(),
})

export async function m10Router(app: FastifyInstance) {
  const service = m10Service(app.db)

  const authRelatorio = {
    preHandler: [
      app.authenticate,
      app.requireRole(['ADMIN_TENANT', 'RH_DP', 'GESTOR', 'AUDITOR']),
    ],
  }

  // GET /v1/dashboard?data_inicio=&data_fim= — KPIs do período
  app.get('/dashboard', authRelatorio, async (req, reply) => {
    const query = periodoSchema.parse(req.query)
    return reply.send(
      await service.dashboard(
        req.jwtPayload.tenantId,
        new Date(query.data_inicio),
        new Date(query.data_fim),
      ),
    )
  })

  // GET /v1/relatorios/faltas?data_inicio=&data_fim=
  app.get('/relatorios/faltas', authRelatorio, async (req, reply) => {
    const query = periodoSchema.parse(req.query)
    return reply.send(
      await service.relatorioFaltas(
        req.jwtPayload.tenantId,
        new Date(query.data_inicio),
        new Date(query.data_fim),
      ),
    )
  })

  // GET /v1/relatorios/he?data_inicio=&data_fim=
  app.get('/relatorios/he', authRelatorio, async (req, reply) => {
    const query = periodoSchema.parse(req.query)
    return reply.send(
      await service.relatorioHE(
        req.jwtPayload.tenantId,
        new Date(query.data_inicio),
        new Date(query.data_fim),
      ),
    )
  })

  // GET /v1/alertas — alertas automáticos (polling do front ou job cron)
  app.get('/alertas', authRelatorio, async (req, reply) => {
    return reply.send(await service.verificarAlertas(req.jwtPayload.tenantId))
  })
}
