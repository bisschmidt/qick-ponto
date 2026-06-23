import fp from 'fastify-plugin'

// Guards RBAC — uso: preHandler: [app.authenticate, app.requireRole(['GESTOR', 'RH_DP'])]
export const tenantPlugin = fp(async (app) => {
  app.decorate(
    'requireRole',
    (roles: string[]) =>
      async (request: import('fastify').FastifyRequest) => {
        if (!roles.includes(request.jwtPayload.role)) {
          throw { statusCode: 403, message: 'Acesso negado para este perfil' }
        }
      },
  )
})

declare module 'fastify' {
  interface FastifyInstance {
    requireRole: (
      roles: string[],
    ) => (request: import('fastify').FastifyRequest) => Promise<void>
  }
}
