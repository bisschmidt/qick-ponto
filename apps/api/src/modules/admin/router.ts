// Endpoints administrativos da Fase C: feriados, banco de horas.

import type { FastifyInstance } from 'fastify'
import { z } from 'zod'

const feriadoSchema = z.object({
  nome: z.string().min(1).max(100),
  tipo: z.enum(['NACIONAL', 'ESTADUAL', 'MUNICIPAL', 'FACULTATIVO']),
  uf: z.string().length(2).nullable().optional(),
  municipio: z.string().max(100).nullable().optional(),
  data_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  data_fim: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

export async function adminRouter(app: FastifyInstance) {
  const authAdmin = {
    preHandler: [app.authenticate, app.requireRole(['ADMIN_TENANT', 'RH_DP'])],
  }
  const authLeitura = {
    preHandler: [app.authenticate, app.requireRole(['ADMIN_TENANT', 'RH_DP', 'GESTOR'])],
  }

  // ── Feriados ──────────────────────────────────────────────────────────────
  app.get('/feriados', authLeitura, async (req) => {
    const { ano } = z.object({ ano: z.string().regex(/^\d{4}$/).optional() }).parse(req.query)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { tenant_id: req.jwtPayload.tenantId }
    if (ano) {
      const ini = new Date(`${ano}-01-01T00:00:00Z`)
      const fim = new Date(`${ano}-12-31T23:59:59Z`)
      where.OR = [
        { data_inicio: { gte: ini, lte: fim } },
        { data_fim:    { gte: ini, lte: fim } },
      ]
    }
    return app.db.feriado.findMany({ where, orderBy: { data_inicio: 'asc' } })
  })

  app.post('/feriados', authAdmin, async (req, reply) => {
    const b = feriadoSchema.parse(req.body)
    const data: Record<string, unknown> = {
      tenant_id: req.jwtPayload.tenantId,
      nome: b.nome,
      tipo: b.tipo,
      data_inicio: new Date(`${b.data_inicio}T00:00:00Z`),
      data_fim: new Date(`${(b.data_fim ?? b.data_inicio)}T00:00:00Z`),
    }
    if (b.uf) data.uf = b.uf
    if (b.municipio) data.municipio = b.municipio
    const f = await app.db.feriado.create({ data: data as never })
    return reply.status(201).send(f)
  })

  app.delete('/feriados/:id', authAdmin, async (req, reply) => {
    const { id } = req.params as { id: string }
    const f = await app.db.feriado.findFirst({
      where: { id, tenant_id: req.jwtPayload.tenantId },
    })
    if (!f) return reply.status(404).send({ message: 'Feriado não encontrado' })
    await app.db.feriado.delete({ where: { id } })
    return reply.send({ ok: true })
  })

}
