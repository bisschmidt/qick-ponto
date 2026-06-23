import type { FastifyInstance } from 'fastify'
import type { TipoMarcacao } from '@prisma/client'
import { z } from 'zod'
import { m9Service } from './service.js'
import { analisarAtestado } from './atestado-ai.js'

const motivoSchema = z.object({
  descricao: z.string().min(1).max(200),
  flag_desconto_va: z.boolean().default(false),
  flag_desconto_vt: z.boolean().default(false),
})

const justificarFaltaSchema = z.object({
  colaborador_id: z.string().uuid(),
  motivo_id: z.string().uuid(),
  data_ponto: z.string().date(),
  justificativa: z.string().min(3).max(500),
})

const solicitarSchema = z.object({
  colaborador_id: z.string().uuid(),
  motivo_id: z.string().uuid(),
  data_ponto: z.string().date(),
  tipo_ajuste: z.string().min(1).max(50),
  justificativa: z.string().min(3).max(500),
  novo_timestamp: z.string().datetime().optional(),
  novo_tipo: z.string().optional(),
  marcacao_ref_id: z.string().uuid().optional(),
})

const decisaoSchema = z.object({
  obs: z.string().max(300).nullable().default(null),
  encaminhar_rh: z.boolean().default(false),
})

const decisaoRHSchema = z.object({
  obs: z.string().max(300).nullable().default(null),
})

const loteSchema = z.object({
  ajuste_ids: z.array(z.string().uuid()).min(1),
  acao: z.enum(['APROVAR', 'REPROVAR']),
  obs: z.string().max(300).default(''),
})

export async function m9Router(app: FastifyInstance) {
  const service = m9Service(app.db)

  // ── Motivos ─────────────────────────────────────────────────────────────────

  app.get('/motivos-ajuste', {
    preHandler: [app.authenticate, app.requireRole(['ADMIN_TENANT', 'RH_DP', 'GESTOR', 'COLABORADOR'])],
  }, async (req, reply) => {
    return reply.send(await service.listarMotivos(req.jwtPayload.tenantId))
  })

  app.post('/motivos-ajuste', {
    preHandler: [app.authenticate, app.requireRole(['ADMIN_TENANT', 'RH_DP'])],
  }, async (req, reply) => {
    const body = motivoSchema.parse(req.body)
    return reply.status(201).send(
      await service.criarMotivo(
        req.jwtPayload.tenantId,
        body.descricao,
        body.flag_desconto_va,
        body.flag_desconto_vt,
      ),
    )
  })

  // ── Solicitações ─────────────────────────────────────────────────────────────

  app.post('/ajustes', {
    preHandler: [
      app.authenticate,
      app.requireRole(['COLABORADOR', 'GESTOR', 'RH_DP', 'ADMIN_TENANT']),
    ],
  }, async (req, reply) => {
    const body = solicitarSchema.parse(req.body)
    const params: Parameters<typeof service.solicitarAjuste>[0] = {
      tenantId: req.jwtPayload.tenantId,
      colaboradorId: body.colaborador_id,
      solicitanteId: req.jwtPayload.sub,
      motivoId: body.motivo_id,
      dataPonto: new Date(body.data_ponto),
      tipoAjuste: body.tipo_ajuste,
      justificativa: body.justificativa,
    }
    if (body.novo_timestamp) params.novoTimestamp = new Date(body.novo_timestamp)
    if (body.novo_tipo) params.novoTipo = body.novo_tipo as TipoMarcacao
    if (body.marcacao_ref_id) params.marcacaoRefId = body.marcacao_ref_id

    const resultado = await service.solicitarAjuste(params)
    return reply.status(201).send(resultado)
  })

  // RH/Admin justifica uma falta diretamente (cria ajuste já aprovado)
  app.post('/ajustes/justificar-falta', {
    preHandler: [app.authenticate, app.requireRole(['RH_DP', 'ADMIN_TENANT'])],
  }, async (req, reply) => {
    const body = justificarFaltaSchema.parse(req.body)
    const resultado = await service.justificarFalta({
      tenantId: req.jwtPayload.tenantId,
      colaboradorId: body.colaborador_id,
      rhId: req.jwtPayload.sub,
      motivoId: body.motivo_id,
      dataPonto: new Date(body.data_ponto),
      justificativa: body.justificativa,
    })
    return reply.status(201).send(resultado)
  })

  // Atestado: multipart, opcionalmente analisado por IA
  app.post('/ajustes/atestado', {
    preHandler: [app.authenticate],
    bodyLimit: 11 * 1024 * 1024,
  }, async (req, reply) => {
    const parts = req.parts()
    let arquivo: Buffer | null = null
    let mediaType = 'application/octet-stream'
    let nomeArquivo = ''
    const fields: Record<string, string> = {}

    for await (const part of parts) {
      if (part.type === 'file' && part.fieldname === 'arquivo') {
        arquivo = await part.toBuffer()
        mediaType = part.mimetype
        nomeArquivo = part.filename
      } else if (part.type === 'field' && typeof part.value === 'string') {
        fields[part.fieldname] = part.value
      }
    }

    if (!arquivo) return reply.status(400).send({ message: 'Arquivo não enviado' })
    const colaboradorId = fields['colaborador_id']
    const dataInicio = fields['data_inicio']
    const dataFim = fields['data_fim']
    const justificativaInformada = fields['justificativa'] ?? 'Atestado médico'
    if (!colaboradorId || !dataInicio || !dataFim) {
      return reply.status(400).send({ message: 'Faltam dados (colaborador_id, data_inicio, data_fim)' })
    }

    // Confere se é o próprio ou tem permissão administrativa
    const ehOproprio = colaboradorId === req.jwtPayload.sub
    const role = req.jwtPayload.role
    const podeOutros = role === 'ADMIN_TENANT' || role === 'RH_DP' || role === 'GESTOR'
    if (!ehOproprio && !podeOutros) {
      return reply.status(403).send({ message: 'Sem permissão para enviar atestado de outro colaborador' })
    }

    const colaborador = await app.db.colaborador.findFirst({
      where: { id: colaboradorId, tenant_id: req.jwtPayload.tenantId },
      select: { id: true, nome_completo: true, cpf: true },
    })
    if (!colaborador) return reply.status(404).send({ message: 'Colaborador não encontrado' })

    // Garante motivo "Atestado médico"
    let motivo = await app.db.motivoAjuste.findFirst({
      where: { tenant_id: req.jwtPayload.tenantId, descricao: 'Atestado médico' },
    })
    if (!motivo) {
      motivo = await app.db.motivoAjuste.create({
        data: {
          tenant_id: req.jwtPayload.tenantId,
          descricao: 'Atestado médico',
          flag_desconto_va: false,
          flag_desconto_vt: true,
        },
      })
    }

    // Roda análise IA (opcional)
    const analise = await analisarAtestado(arquivo, mediaType, {
      nomeColaborador: colaborador.nome_completo,
      cpfColaborador: colaborador.cpf,
      dataInicioInformada: dataInicio,
      dataFimInformada: dataFim,
    })

    // Monta justificativa final com resumo da análise
    let justificativa = justificativaInformada
    if (analise) {
      justificativa = `${justificativa} | IA: ${analise.resumo}`
      if (analise.anomalias.length > 0) {
        justificativa += ` | ⚠ Anomalias: ${analise.anomalias.join('; ')}`
      }
      justificativa = justificativa.slice(0, 500)
    }

    // Cria 1 ajuste por dia do período (mais granular para casamento com FALTA)
    const ini = new Date(`${dataInicio}T00:00:00Z`)
    const fim = new Date(`${dataFim}T00:00:00Z`)
    const ajustesCriados: string[] = []
    for (let d = new Date(ini); d <= fim; d.setUTCDate(d.getUTCDate() + 1)) {
      const a = await app.db.ajuste.create({
        data: {
          tenant_id: req.jwtPayload.tenantId,
          colaborador_id: colaboradorId,
          solicitante_id: req.jwtPayload.sub,
          motivo_id: motivo.id,
          data_ponto: new Date(d),
          tipo_ajuste: 'ATESTADO',
          justificativa,
          // Vai direto pro RH (atestado não precisa do gestor)
          status: 'PENDENTE_RH',
          // Anexa info do arquivo dentro de novo_timestamp? Não, melhor não. Filename fica no log.
        },
      })
      ajustesCriados.push(a.id)
    }

    return reply.status(201).send({
      ok: true,
      ajustes: ajustesCriados.length,
      arquivo: nomeArquivo,
      analiseIA: analise ?? null,
    })
  })

  app.get('/ajustes/pendentes', {
    preHandler: [app.authenticate, app.requireRole(['ADMIN_TENANT', 'RH_DP', 'GESTOR'])],
  }, async (req, reply) => {
    const { etapa = 'GESTOR' } = req.query as { etapa?: string }
    return reply.send(
      await service.listarAjustesPendentes(
        req.jwtPayload.tenantId,
        etapa === 'RH' ? 'RH' : 'GESTOR',
      ),
    )
  })

  app.get('/ajustes/:id', {
    preHandler: [
      app.authenticate,
      app.requireRole(['ADMIN_TENANT', 'RH_DP', 'GESTOR', 'AUDITOR']),
    ],
  }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const ajuste = await service.buscarAjuste(req.jwtPayload.tenantId, id)
    if (!ajuste) return reply.status(404).send({ error: 'Ajuste não encontrado' })
    return reply.send(ajuste)
  })

  // ── Aprovações ──────────────────────────────────────────────────────────────

  app.post('/ajustes/:id/aprovar-gestor', {
    preHandler: [app.authenticate, app.requireRole(['GESTOR', 'ADMIN_TENANT', 'RH_DP'])],
  }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const body = decisaoSchema.parse(req.body)
    const resultado = await service.aprovarGestor(
      req.jwtPayload.tenantId,
      id,
      req.jwtPayload.sub,
      body.obs,
      body.encaminhar_rh,
    )
    return reply.send(resultado)
  })

  app.post('/ajustes/:id/reprovar-gestor', {
    preHandler: [app.authenticate, app.requireRole(['GESTOR', 'ADMIN_TENANT', 'RH_DP'])],
  }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const { obs } = z.object({ obs: z.string().min(1).max(300) }).parse(req.body)
    const resultado = await service.reprovarGestor(
      req.jwtPayload.tenantId,
      id,
      req.jwtPayload.sub,
      obs,
    )
    return reply.send(resultado)
  })

  app.post('/ajustes/:id/aprovar-rh', {
    preHandler: [app.authenticate, app.requireRole(['RH_DP', 'ADMIN_TENANT'])],
  }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const body = decisaoRHSchema.parse(req.body)
    const resultado = await service.aprovarRH(
      req.jwtPayload.tenantId,
      id,
      req.jwtPayload.sub,
      body.obs,
    )
    return reply.send(resultado)
  })

  app.post('/ajustes/:id/reprovar-rh', {
    preHandler: [app.authenticate, app.requireRole(['RH_DP', 'ADMIN_TENANT'])],
  }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const { obs } = z.object({ obs: z.string().min(1).max(300) }).parse(req.body)
    const resultado = await service.reprovarRH(
      req.jwtPayload.tenantId,
      id,
      req.jwtPayload.sub,
      obs,
    )
    return reply.send(resultado)
  })

  // ── Lote RH ─────────────────────────────────────────────────────────────────

  app.post('/ajustes/lote', {
    preHandler: [app.authenticate, app.requireRole(['RH_DP', 'ADMIN_TENANT'])],
  }, async (req, reply) => {
    const body = loteSchema.parse(req.body)
    const resultado = await service.processarLoteRH(
      req.jwtPayload.tenantId,
      body.ajuste_ids,
      req.jwtPayload.sub,
      body.acao,
      body.obs,
    )
    return reply.send(resultado)
  })
}
