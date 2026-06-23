import type { PrismaClient } from '@prisma/client'

// NSR: sequencial por CNPJ, sem gaps, crescente por ordem de gravação.
// Usa SELECT ... FOR UPDATE para serializar incrementos concorrentes.
export async function alocarNsr(db: PrismaClient, cnpjEstabId: string): Promise<bigint> {
  return db.$transaction(async (tx) => {
    const result = await tx.$queryRaw<[{ nsr: bigint }]>`
      UPDATE "CnpjEstabelecimento"
      SET nsr_contador = nsr_contador + 1
      WHERE id = ${cnpjEstabId}::uuid
      RETURNING nsr_contador AS nsr
    `

    const row = result[0] as { nsr: bigint } | undefined
    if (!row) throw new Error(`CnpjEstabelecimento ${cnpjEstabId} não encontrado`)

    return row.nsr
  })
}
