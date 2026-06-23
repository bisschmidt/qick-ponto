import type { PrismaClient } from '@prisma/client'

const DEFAULTS = {
  max_min_dia: 120,
  max_min_semana: 600,
  max_min_mes: 2400,
  intervalo_min_apos_jornada_min: 60,
}

export function configHeService(db: PrismaClient) {
  return {
    // Retorna a config do tenant ou os defaults (sem exigir registro prévio)
    async obter(tenantId: string) {
      const cfg = await db.configHe.findUnique({ where: { tenant_id: tenantId } })
      return {
        max_min_dia: cfg?.max_min_dia ?? DEFAULTS.max_min_dia,
        max_min_semana: cfg?.max_min_semana ?? DEFAULTS.max_min_semana,
        max_min_mes: cfg?.max_min_mes ?? DEFAULTS.max_min_mes,
        intervalo_min_apos_jornada_min: cfg?.intervalo_min_apos_jornada_min ?? DEFAULTS.intervalo_min_apos_jornada_min,
      }
    },

    async atualizar(
      tenantId: string,
      dados: {
        max_min_dia: number
        max_min_semana: number
        max_min_mes: number
        intervalo_min_apos_jornada_min: number
      },
    ) {
      return db.configHe.upsert({
        where: { tenant_id: tenantId },
        update: dados,
        create: { tenant_id: tenantId, ...dados },
      })
    },
  }
}
