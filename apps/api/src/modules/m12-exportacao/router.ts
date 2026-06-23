import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { m12Service, EVENTOS_FOLHA } from './service.js'

const sistemaSchema = z.enum(['QUESTOR'])
const eventoSchema = z.enum(['HE_50', 'HE_100', 'ADICIONAL_NOTURNO', 'FALTA', 'FALTA_DSR', 'ATRASO', 'HORA_REDUZIDA'])

const exportarQuerySchema = z.object({
  sistema:        sistemaSchema,
  cnpj_estab_id:  z.string().uuid(),
  competencia_ini: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  competencia_fim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

const configSchema = z.object({
  sistema: sistemaSchema,
  codigo_empresa: z.string().min(1).max(20),
})

const mapeamentoSchema = z.object({
  sistema: sistemaSchema,
  evento: eventoSchema,
  codigo_externo: z.string().min(1).max(20),
})

const codigoColabSchema = z.object({
  colaborador_id: z.string().uuid(),
  sistema: sistemaSchema,
  codigo: z.string().min(1).max(20),
})

export async function m12Router(app: FastifyInstance) {
  const service = m12Service(app.db)

  const authRH = {
    preHandler: [app.authenticate, app.requireRole(['ADMIN_TENANT', 'RH_DP'])],
  }

  // ── Sistemas suportados + eventos canônicos ─────────────────────────────
  app.get('/exportacao-folha/sistemas', authRH, async () => {
    return {
      sistemas: ['QUESTOR'],
      eventos: EVENTOS_FOLHA,
    }
  })

  // ── Configuração ─────────────────────────────────────────────────────────
  app.get('/exportacao-folha/config', authRH, async (req) => {
    const { sistema } = z.object({ sistema: sistemaSchema }).parse(req.query)
    return service.getConfig(req.jwtPayload.tenantId, sistema)
  })

  app.post('/exportacao-folha/config', authRH, async (req, reply) => {
    const body = configSchema.parse(req.body)
    const r = await service.upsertConfig(req.jwtPayload.tenantId, body.sistema, body.codigo_empresa)
    return reply.send(r)
  })

  // ── Mapeamento ───────────────────────────────────────────────────────────
  app.get('/exportacao-folha/mapeamento', authRH, async (req) => {
    const { sistema } = z.object({ sistema: sistemaSchema }).parse(req.query)
    return service.listarMapeamento(req.jwtPayload.tenantId, sistema)
  })

  app.post('/exportacao-folha/mapeamento', authRH, async (req, reply) => {
    const body = mapeamentoSchema.parse(req.body)
    const r = await service.upsertMapeamento(
      req.jwtPayload.tenantId,
      body.sistema,
      body.evento,
      body.codigo_externo,
    )
    return reply.send(r)
  })

  // ── Código do colaborador ────────────────────────────────────────────────
  app.post('/exportacao-folha/codigo-colaborador', authRH, async (req, reply) => {
    const body = codigoColabSchema.parse(req.body)
    const r = await service.upsertCodigoColaborador(body.colaborador_id, body.sistema, body.codigo)
    return reply.send(r)
  })

  // ── Validação ────────────────────────────────────────────────────────────
  app.get('/exportacao-folha/validar', authRH, async (req) => {
    const q = exportarQuerySchema.parse(req.query)
    return service.validar({
      tenantId: req.jwtPayload.tenantId,
      sistema: q.sistema,
      cnpjEstabId: q.cnpj_estab_id,
      competenciaIni: new Date(q.competencia_ini),
      competenciaFim: new Date(`${q.competencia_fim}T23:59:59.999-03:00`),
    })
  })

  // ── Exportar (gerar arquivo) ─────────────────────────────────────────────
  app.get('/exportacao-folha/gerar', authRH, async (req, reply) => {
    const q = exportarQuerySchema.parse(req.query)
    try {
      const resultado = await service.exportar({
        tenantId: req.jwtPayload.tenantId,
        sistema: q.sistema,
        cnpjEstabId: q.cnpj_estab_id,
        competenciaIni: new Date(q.competencia_ini),
        competenciaFim: new Date(`${q.competencia_fim}T23:59:59.999-03:00`),
        solicitanteId: req.jwtPayload.sub,
      })
      return reply
        .header('Content-Type', resultado.contentType)
        .header('Content-Disposition', `attachment; filename="${resultado.nomeArquivo}"`)
        .header('X-Total-Linhas', String(resultado.totalLinhas))
        .send(resultado.buffer)
    } catch (err: unknown) {
      const e = err as { statusCode?: number; message?: string; pendencias?: unknown }
      if (e.statusCode === 422) {
        return reply.status(422).send({ message: e.message, pendencias: e.pendencias })
      }
      throw err
    }
  })

  // ── Histórico ────────────────────────────────────────────────────────────
  app.get('/exportacao-folha/historico', authRH, async (req) => {
    const { sistema } = z.object({ sistema: sistemaSchema }).parse(req.query)
    return service.listarHistorico(req.jwtPayload.tenantId, sistema)
  })
}
