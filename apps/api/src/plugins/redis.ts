import fp from 'fastify-plugin'

// Redis é opcional — quando REDIS_URL não está configurado, jobs são desativados
declare module 'fastify' {
  interface FastifyInstance {
    redisUrl: string | null
  }
}

export const redisPlugin = fp(async (app) => {
  const url = process.env['REDIS_URL'] ?? null

  if (!url) {
    app.log.warn('REDIS_URL não configurado — fila de jobs desativada')
  }

  app.decorate('redisUrl', url)
})
