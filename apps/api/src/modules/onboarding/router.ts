import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { hashSenha } from '../auth/router.js'

const completarSchema = z.object({
  token: z.string().min(1),
  senha: z.string().min(6),
  aceite_lgpd: z.literal(true),
})

export async function onboardingRouter(app: FastifyInstance) {
  // GET /v1/onboarding/verificar?token=xxx — valida token e retorna nome do colaborador
  app.get('/onboarding/verificar', async (req, reply) => {
    const { token } = req.query as { token?: string }
    if (!token) return reply.status(400).send({ error: 'Token obrigatório' })

    const usuario = await app.db.usuario.findUnique({
      where: { onboarding_token: token },
      include: { colaborador: true },
    })

    if (!usuario || !usuario.onboarding_token_expires) {
      return reply.status(404).send({ error: 'Link inválido ou já utilizado' })
    }
    if (new Date() > usuario.onboarding_token_expires) {
      return reply.status(410).send({ error: 'Link expirado. Solicite um novo ao seu gestor.' })
    }

    return reply.send({
      nome: usuario.colaborador.nome_completo,
      email: usuario.colaborador.email_corporativo,
    })
  })

  // POST /v1/onboarding/completar — define senha + registra aceite LGPD
  app.post('/onboarding/completar', async (req, reply) => {
    const input = completarSchema.parse(req.body)

    const usuario = await app.db.usuario.findUnique({
      where: { onboarding_token: input.token },
      include: { colaborador: true },
    })

    if (!usuario || !usuario.onboarding_token_expires) {
      return reply.status(404).send({ error: 'Link inválido ou já utilizado' })
    }
    if (new Date() > usuario.onboarding_token_expires) {
      return reply.status(410).send({ error: 'Link expirado. Solicite um novo ao seu gestor.' })
    }

    const senhaHash = await hashSenha(input.senha)
    const ip = req.ip

    await app.db.$transaction([
      app.db.usuario.update({
        where: { id: usuario.id },
        data: {
          senha_hash: senhaHash,
          onboarding_token: null,
          onboarding_token_expires: null,
        },
      }),
      app.db.aceiteLgpd.upsert({
        where: { colaborador_id: usuario.colaborador_id },
        create: {
          colaborador_id: usuario.colaborador_id,
          timestamp_aceite: new Date(),
          ip,
          versao_aviso: '1.0',
        },
        update: {
          timestamp_aceite: new Date(),
          ip,
        },
      }),
      app.db.colaborador.update({
        where: { id: usuario.colaborador_id },
        data: { onboarding_ok: true },
      }),
    ])

    return reply.send({ ok: true, email: usuario.colaborador.email_corporativo })
  })
}
