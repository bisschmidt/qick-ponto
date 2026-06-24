import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { scrypt, timingSafeEqual, randomBytes } from 'node:crypto'
import { promisify } from 'node:util'

const scryptAsync = promisify(scrypt)

const loginSchema = z.object({
  email: z.string().email(),
  senha: z.string().min(6),
})

async function verificarSenha(senha: string, hash: string): Promise<boolean> {
  // formato: salt:hash (hex)
  const [saltHex, hashHex] = hash.split(':')
  if (!saltHex || !hashHex) return false
  const salt = Buffer.from(saltHex, 'hex')
  const derivado = (await scryptAsync(senha, salt, 64)) as Buffer
  const hashBuf = Buffer.from(hashHex, 'hex')
  if (derivado.length !== hashBuf.length) return false
  return timingSafeEqual(derivado, hashBuf)
}

export async function hashSenha(senha: string): Promise<string> {
  const salt = randomBytes(16)
  const hash = (await scryptAsync(senha, salt, 64)) as Buffer
  return `${salt.toString('hex')}:${hash.toString('hex')}`
}

export async function authRouter(app: FastifyInstance) {
  // POST /v1/auth/login
  // Rate limit por CONTA (e-mail), não por IP: o tráfego chega pelos IPs do Vercel
  // (server-to-server), então limitar por IP travaria logins legítimos no pico de turno.
  app.post(
    '/auth/login',
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: '5 minutes',
          keyGenerator: (req) => {
            const email = (req.body as { email?: string } | undefined)?.email
            return email ? `login:${email.toLowerCase()}` : `login-ip:${req.ip}`
          },
        },
      },
    },
    async (req, reply) => {
    const body = loginSchema.parse(req.body)

    const usuario = await app.db.usuario.findFirst({
      where: {
        colaborador: { email_corporativo: body.email },
        ativo: true,
      },
      include: {
        colaborador: {
          include: { cnpj_estab: true },
        },
      },
    })

    if (!usuario) {
      return reply.status(401).send({ message: 'Email ou senha incorretos' })
    }

    if (!usuario.senha_hash) {
      return reply.status(401).send({ message: 'Cadastro pendente — complete o onboarding pelo link enviado por email' })
    }
    const senhaOk = await verificarSenha(body.senha, usuario.senha_hash)
    if (!senhaOk) {
      return reply.status(401).send({ message: 'Email ou senha incorretos' })
    }

    const token = app.jwt.sign({
      sub: usuario.colaborador_id,
      tenantId: usuario.tenant_id,
      cnpjEstabId: usuario.colaborador.cnpj_estab_id,
      role: usuario.perfil,
      nome: usuario.colaborador.nome_completo,
    })

    return reply.send({
      token,
      colaborador: {
        id: usuario.colaborador_id,
        nome_completo: usuario.colaborador.nome_completo,
        role: usuario.perfil,
      },
    })
  })
}
