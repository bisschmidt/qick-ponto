import { config } from 'dotenv'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
config({ path: resolve(__dirname, '../../../.env') })
import Fastify from 'fastify'
import multipart from '@fastify/multipart'
import helmet from '@fastify/helmet'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import { dbPlugin } from './plugins/db.js'
import { authPlugin } from './plugins/auth.js'
import { redisPlugin } from './plugins/redis.js'
import { tenantPlugin } from './plugins/tenant.js'
import { authRouter } from './modules/auth/router.js'
import { m1Router } from './modules/m1-cadastro/router.js'
import { m2Router } from './modules/m2-marcacao/router.js'
import { m3Router } from './modules/m3-pausas/router.js'
import { m4Router } from './modules/m4-apuracao/router.js'
import { m5Router } from './modules/m5-banco-horas/router.js'
import { m6Router } from './modules/m6-fechamento/router.js'
import { m7Router } from './modules/m7-afd/router.js'
import { m8Router } from './modules/m8-pslz/router.js'
import { m9Router } from './modules/m9-excecoes/router.js'
import { m10Router } from './modules/m10-alertas/router.js'
import { m12Router } from './modules/m12-exportacao/router.js'
import { gestorRouter } from './modules/gestor/router.js'
import { heRouter } from './modules/he/router.js'
import { adminRouter } from './modules/admin/router.js'
import { onboardingRouter } from './modules/onboarding/router.js'

// BigInt fields (NSR) must be serialized as strings — JSON.stringify doesn't handle BigInt natively
;(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function () {
  return this.toString()
}

const app = Fastify({
  logger: {
    level: process.env['LOG_LEVEL'] ?? 'info',
  },
})

app.get('/health', async () => ({ ok: true }))

// Cabeçalhos de segurança (HSTS, X-Content-Type-Options, frameguard, etc.).
// CSP desligado: é uma API JSON, não serve HTML.
await app.register(helmet, { contentSecurityPolicy: false })

// CORS fechado por padrão (o front chama a API server-to-server, não pelo browser).
// Para liberar um app mobile/SPA no futuro: setar CORS_ORIGINS=https://a,https://b
await app.register(cors, {
  origin: process.env['CORS_ORIGINS']
    ? process.env['CORS_ORIGINS'].split(',').map((s) => s.trim())
    : false,
})

// Rate limit aplicado por rota (global:false). hook=preHandler para a chave poder ler o body.
// Importante: o tráfego do site chega pelos IPs do Vercel (server-to-server), então limitar
// por IP seria ineficaz/perigoso — o login é limitado por CONTA (e-mail). Ver auth/router.ts.
await app.register(rateLimit, { global: false, hook: 'preHandler' })

await app.register(multipart, {
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
})
await app.register(dbPlugin)
await app.register(redisPlugin)
await app.register(authPlugin)
await app.register(tenantPlugin)

await app.register(authRouter, { prefix: '/v1' })
await app.register(m1Router, { prefix: '/v1' })
await app.register(m2Router, { prefix: '/v1' })
await app.register(m3Router, { prefix: '/v1' })
await app.register(m4Router, { prefix: '/v1' })
await app.register(m5Router, { prefix: '/v1' })
await app.register(m6Router, { prefix: '/v1' })
await app.register(m7Router, { prefix: '/v1' })
await app.register(m8Router, { prefix: '/v1' })
await app.register(m9Router, { prefix: '/v1' })
await app.register(m10Router, { prefix: '/v1' })
await app.register(m12Router, { prefix: '/v1' })
await app.register(gestorRouter, { prefix: '/v1' })
await app.register(heRouter, { prefix: '/v1' })
await app.register(adminRouter, { prefix: '/v1' })
await app.register(onboardingRouter, { prefix: '/v1' })


const port = Number(process.env['PORT'] ?? 3000)
await app.listen({ port, host: '0.0.0.0' })
