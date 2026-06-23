import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { m3Service } from './service.js'

const painelSchema = z.object({
  colaborador_id: z.string().uuid(),
})

const relatorioSchema = z.object({
  cnpj_estab_id: z.string().uuid(),
  data_inicio: z.string().date(),
  data_fim: z.string().date(),
})

export async function m3Router(app: FastifyInstance) {
  const service = m3Service(app.db)

  // GET /v1/nr17/painel?colaborador_id= — status em tempo real (polling do front)
  app.get('/nr17/painel', {
    preHandler: [
      app.authenticate,
      app.requireRole(['ADMIN_TENANT', 'RH_DP', 'GESTOR', 'COLABORADOR']),
    ],
  }, async (req, reply) => {
    const { colaborador_id } = painelSchema.parse(req.query)
    const resultado = await service.painelNr17(req.jwtPayload.tenantId, colaborador_id)
    return reply.send(resultado)
  })

  // GET /v1/nr17/relatorio?cnpj_estab_id=&data_inicio=&data_fim= — conformidade do período
  app.get('/nr17/relatorio', {
    preHandler: [
      app.authenticate,
      app.requireRole(['ADMIN_TENANT', 'RH_DP', 'AUDITOR']),
    ],
  }, async (req, reply) => {
    const query = relatorioSchema.parse(req.query)
    const resultado = await service.relatorioConformidade(
      req.jwtPayload.tenantId,
      query.cnpj_estab_id,
      new Date(query.data_inicio),
      new Date(query.data_fim),
    )
    return reply.send(resultado)
  })
}
