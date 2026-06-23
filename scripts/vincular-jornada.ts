import { config } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '../.env') })

import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function main() {
  const cols = await db.colaborador.findMany({
    select: { id: true, nome_completo: true, data_admissao: true },
    orderBy: { created_at: 'desc' },
  })
  const jors = await db.jornada.findMany({ select: { id: true, nome: true } })

  if (jors.length === 0) {
    console.log('Nenhuma jornada cadastrada. Crie uma jornada primeiro.')
    return
  }

  const semJornada: typeof cols = []
  for (const c of cols) {
    const jaTemJornada = await db.colaboradorJornada.findFirst({
      where: { colaborador_id: c.id, data_fim: null },
    })
    if (!jaTemJornada) semJornada.push(c)
  }

  console.log(`\nJornadas disponíveis:`)
  jors.forEach((j) => console.log(`  ${j.nome} — ${j.id}`))

  if (semJornada.length === 0) {
    console.log('\nTodos os colaboradores já têm jornada ativa.')
    return
  }

  const jornada = jors[0]!
  console.log(`\nVinculando ${semJornada.length} colaborador(es) à jornada "${jornada.nome}"...`)

  for (const c of semJornada) {
    await db.colaboradorJornada.create({
      data: {
        colaborador_id: c.id,
        jornada_id:     jornada.id,
        data_inicio:    c.data_admissao,
        usuario_id:     c.id,
      },
    })
    console.log(`  ✓ ${c.nome_completo}`)
  }

  console.log('\nPronto! Recarregue a tela /ponto.')
}

main()
  .catch((e) => { console.error('Erro:', e); process.exit(1) })
  .finally(() => db.$disconnect())
