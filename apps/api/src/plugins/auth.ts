import fp from 'fastify-plugin'
import fastifyJwt from '@fastify/jwt'
import type { PerfilAcesso } from '@prisma/client'

export interface JwtPayload {
  sub: string        // colaboradorId
  tenantId: string
  cnpjEstabId: string
  role: PerfilAcesso
  nome: string
}

declare module 'fastify' {
  interface FastifyRequest {
    jwtPayload: JwtPayload
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtPayload
    user: JwtPayload
  }
}

export const authPlugin = fp(async (app) => {
  await app.register(fastifyJwt, {
    secret: process.env['JWT_SECRET'] ?? 'dev-secret-change-in-prod',
    sign: { expiresIn: '8h' },
  })

  app.decorate('authenticate', async (request: import('fastify').FastifyRequest) => {
    await request.jwtVerify()
    request.jwtPayload = request.user as JwtPayload
  })
})

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: import('fastify').FastifyRequest) => Promise<void>
  }
}
