import fp from 'fastify-plugin'
import { PrismaClient } from '@prisma/client'

declare module 'fastify' {
  interface FastifyInstance {
    db: PrismaClient
  }
}

export const dbPlugin = fp(async (app) => {
  const db = new PrismaClient({
    log: app.log.level === 'debug' ? ['query'] : ['error'],
  })
  await db.$connect()
  app.decorate('db', db)
  app.addHook('onClose', async () => db.$disconnect())
})
