import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { m5Service } from './service.js'

const creditarSchema = z.object({
  colaborador_id: z.string().uuid(),
  data_referencia: z.string().date(),
  minutos_he_50: z.number().int().nonnegative(),
  minutos_he_100: z.number().int().nonnegative(),
  modalidade: z.enum(['ACORDO_INDIVIDUAL', 'ACT_CCT', 'COMPENSACAO_MENSAL']),
})

const debitarSchema = z.object({
  colaborador_id: z.string().uuid(),
  data_compensacao: z.string().date(),
  minutos: z.number().int().positive(),
  descricao: z.string().min(1).max(200),
})

const extratoSchema = z.object({
  colaborador_id: z.string().uuid(),
  data_inicio: z.string().date(),
  data_fim: z.string().date(),
})

export async function m5Router(app: FastifyInstance) {
  const service = m5Service(app.db)

  const authRH = {
    preHandler: [app.authenticate, app.requireRole(['ADMIN_TENANT', 'RH_DP', 'GESTOR'])],
  }

  // POST /v1/banco-horas/creditar — creditar HE no banco
  app.post('/banco-horas/creditar', authRH, async (req, reply) => {
    const body = creditarSchema.parse(req.body)
    const resultado = await service.creditarHorasExtras(
      req.jwtPayload.tenantId,
      body.colaborador_id,
      new Date(body.data_referencia),
      body.minutos_he_50,
      body.minutos_he_100,
      body.modalidade,
    )
    return reply.status(201).send(resultado)
  })

  // POST /v1/banco-horas/debitar — registrar compensação
  app.post('/banco-horas/debitar', authRH, async (req, reply) => {
    const body = debitarSchema.parse(req.body)
    const resultado = await service.debitarCompensacao(
      req.jwtPayload.tenantId,
      body.colaborador_id,
      new Date(body.data_compensacao),
      body.minutos,
      body.descricao,
    )
    return reply.status(201).send(resultado)
  })

  // GET /v1/banco-horas/extrato?colaborador_id=&data_inicio=&data_fim= — extrato
  app.get('/banco-horas/extrato', {
    preHandler: [
      app.authenticate,
      app.requireRole(['ADMIN_TENANT', 'RH_DP', 'GESTOR', 'COLABORADOR', 'AUDITOR']),
    ],
  }, async (req, reply) => {
    const query = extratoSchema.parse(req.query)
    const resultado = await service.buscarExtrato(
      req.jwtPayload.tenantId,
      query.colaborador_id,
      new Date(query.data_inicio),
      new Date(query.data_fim),
    )
    return reply.send(resultado)
  })

  // GET /v1/banco-horas/resumo — todos os colaboradores
  app.get('/banco-horas/resumo', {
    preHandler: [app.authenticate, app.requireRole(['ADMIN_TENANT', 'RH_DP', 'AUDITOR'])],
  }, async (req, reply) => {
    return reply.send(await service.buscarResumoTenant(req.jwtPayload.tenantId))
  })

  // GET /v1/banco-horas/vencimentos — horas prestes a vencer
  app.get('/banco-horas/vencimentos', authRH, async (req, reply) => {
    const { dias } = req.query as { dias?: string }
    return reply.send(await service.verificarVencimentos(req.jwtPayload.tenantId, Number(dias ?? 30)))
  })
}
