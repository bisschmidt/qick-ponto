import type { FastifyInstance } from 'fastify'
import { ApurarPeriodoSchema, ApurarLoteSchema, BuscarApuracaoSchema, BuscarResumoSchema } from './schema.js'
import { m4Service } from './service.js'

// "2026-06-01" → 00:00 BRT (03:00 UTC) — início do dia em BRT
function inicioDiaBRT(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00-03:00`)
}
// "2026-06-20" → 23:59:59.999 BRT (02:59:59.999 UTC do dia seguinte) — fim do dia em BRT
function fimDiaBRT(dateStr: string): Date {
  return new Date(`${dateStr}T23:59:59.999-03:00`)
}

export async function m4Router(app: FastifyInstance) {
  const service = m4Service(app.db)

  const authRH = {
    preHandler: [app.authenticate, app.requireRole(['ADMIN_TENANT', 'RH_DP', 'GESTOR'])],
  }

  const authLeitura = {
    preHandler: [
      app.authenticate,
      app.requireRole(['ADMIN_TENANT', 'RH_DP', 'GESTOR', 'COLABORADOR', 'AUDITOR']),
    ],
  }

  // POST /v1/apuracao — dispara apuração manual de um colaborador
  app.post('/apuracao', authRH, async (req, reply) => {
    const body = ApurarPeriodoSchema.parse(req.body)

    const resultado = await service.apurarPeriodo(
      req.jwtPayload.tenantId,
      body.colaborador_id,
      inicioDiaBRT(body.data_inicio),
      fimDiaBRT(body.data_fim),
    )

    return reply.status(200).send(resultado)
  })

  // POST /v1/apuracao/lote — apura todos os colaboradores ativos do tenant
  app.post('/apuracao/lote', authRH, async (req, reply) => {
    const body = ApurarLoteSchema.parse(req.body)

    const resultado = await service.apurarLote(
      req.jwtPayload.tenantId,
      inicioDiaBRT(body.data_inicio),
      fimDiaBRT(body.data_fim),
    )

    return reply.status(200).send(resultado)
  })

  // GET /v1/apuracao?colaborador_id=&data_inicio=&data_fim= — apuração calculada
  app.get('/apuracao', authLeitura, async (req, reply) => {
    const query = BuscarApuracaoSchema.parse(req.query)

    const dias = await service.buscarApuracao(
      req.jwtPayload.tenantId,
      query.colaborador_id,
      inicioDiaBRT(query.data_inicio),
      fimDiaBRT(query.data_fim),
    )

    return reply.send(dias)
  })

  // GET /v1/apuracao/inconsistencias?data_inicio=&data_fim= — faltas/inconsistências pendentes
  app.get('/apuracao/inconsistencias', authRH, async (req, reply) => {
    const query = BuscarResumoSchema.parse(req.query)
    const lista = await service.listarInconsistenciasPendentes(
      req.jwtPayload.tenantId,
      inicioDiaBRT(query.data_inicio),
      fimDiaBRT(query.data_fim),
    )
    return reply.send(lista)
  })

  // GET /v1/apuracao/resumo?data_inicio=&data_fim= — totais por colaborador
  app.get('/apuracao/resumo', {
    preHandler: [app.authenticate, app.requireRole(['ADMIN_TENANT', 'RH_DP', 'AUDITOR'])],
  }, async (req, reply) => {
    const query = BuscarResumoSchema.parse(req.query)

    const resumo = await service.buscarResumoPeriodo(
      req.jwtPayload.tenantId,
      inicioDiaBRT(query.data_inicio),
      fimDiaBRT(query.data_fim),
    )

    return reply.send(resumo)
  })
}
