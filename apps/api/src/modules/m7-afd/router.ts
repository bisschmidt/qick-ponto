import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import JSZip from 'jszip'
import { m7Service } from './service.js'

const querySchema = z.object({
  cnpj_estab_id: z.string().uuid(),
  data_inicio: z.string().date(),
  data_fim: z.string().date(),
})

export async function m7Router(app: FastifyInstance) {
  const service = m7Service(app.db)

  const authRH = {
    preHandler: [app.authenticate, app.requireRole(['ADMIN_TENANT', 'RH_DP', 'AUDITOR'])],
  }

  // Gerar e baixar o AFD
  app.get('/afd/gerar', authRH, async (req, reply) => {
    const query = querySchema.parse(req.query)

    const resultado = await service.gerarAfdPorPeriodo(
      req.jwtPayload.tenantId,
      query.cnpj_estab_id,
      new Date(query.data_inicio),
      new Date(query.data_fim),
    )

    // Se houver assinatura digital, retorna ZIP com .txt + .p7s
    if (resultado.assinatura) {
      const zip = new JSZip()
      zip.file(resultado.nomeArquivo, resultado.buffer)
      zip.file(resultado.assinatura.nomeP7s, resultado.assinatura.p7s)
      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' })
      const zipName = resultado.nomeArquivo.replace(/\.txt$/, '.zip')
      return reply
        .header('Content-Type', 'application/zip')
        .header('Content-Disposition', `attachment; filename="${zipName}"`)
        .header('X-AFD-Hash-SHA256', resultado.assinatura.hashSha256)
        .send(zipBuffer)
    }

    // Sem assinatura — retorna apenas o .txt (modo dev)
    return reply
      .header('Content-Type', 'text/plain; charset=iso-8859-1')
      .header('Content-Disposition', `attachment; filename="${resultado.nomeArquivo}"`)
      .send(resultado.buffer)
  })

  // Gerar e baixar o AEJ (Arquivo Eletrônico de Jornada — Anexo VI)
  app.get('/aej/gerar', authRH, async (req, reply) => {
    const query = querySchema.parse(req.query)

    const resultado = await service.gerarAejPorPeriodo(
      req.jwtPayload.tenantId,
      query.cnpj_estab_id,
      new Date(query.data_inicio),
      new Date(query.data_fim),
    )

    if (resultado.assinatura) {
      const zip = new JSZip()
      zip.file(resultado.nomeArquivo, resultado.buffer)
      zip.file(resultado.assinatura.nomeP7s, resultado.assinatura.p7s)
      const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' })
      const zipName = resultado.nomeArquivo.replace(/\.txt$/, '.zip')
      return reply
        .header('Content-Type', 'application/zip')
        .header('Content-Disposition', `attachment; filename="${zipName}"`)
        .header('X-AEJ-Hash-SHA256', resultado.assinatura.hashSha256)
        .send(zipBuffer)
    }

    return reply
      .header('Content-Type', 'text/plain; charset=iso-8859-1')
      .header('Content-Disposition', `attachment; filename="${resultado.nomeArquivo}"`)
      .send(resultado.buffer)
  })

  // Histórico de gerações
  app.get('/afd/historico', authRH, async (req) => {
    const { cnpj_estab_id } = req.query as { cnpj_estab_id: string }
    return service.listarGeracoes(req.jwtPayload.tenantId, cnpj_estab_id)
  })
}
