import { PrismaClient } from '@prisma/client'

const DB_URL = 'postgresql://postgres:EMYquNeYVHUxUozGnhUAQtzQlYyIUfNl@crossover.proxy.rlwy.net:46498/railway'
const db = new PrismaClient({ datasources: { db: { url: DB_URL } } })
const TENANT_ID = '00000000-0000-0000-0000-000000000001'

const motivos = [
  { descricao: 'Atestado médico',            flag_desconto_va: false, flag_desconto_vt: true  },
  { descricao: 'Falta abonada',              flag_desconto_va: false, flag_desconto_vt: false },
  { descricao: 'Falta injustificada',        flag_desconto_va: true,  flag_desconto_vt: true  },
  { descricao: 'Folga compensação',          flag_desconto_va: false, flag_desconto_vt: false },
  { descricao: 'Atestado dependente',        flag_desconto_va: false, flag_desconto_vt: true  },
  { descricao: 'Licença óbito',              flag_desconto_va: false, flag_desconto_vt: false },
  { descricao: 'Licença casamento',          flag_desconto_va: false, flag_desconto_vt: false },
  { descricao: 'Doação de sangue',           flag_desconto_va: false, flag_desconto_vt: false },
  { descricao: 'Esquecimento de marcação',   flag_desconto_va: false, flag_desconto_vt: false },
  { descricao: 'Problema técnico no ponto',  flag_desconto_va: false, flag_desconto_vt: false },
]

async function main() {
  for (const m of motivos) {
    const existe = await db.motivoAjuste.findFirst({
      where: { tenant_id: TENANT_ID, descricao: m.descricao },
    })
    if (existe) {
      console.log(`  ~ ${m.descricao}`)
      continue
    }
    await db.motivoAjuste.create({
      data: { tenant_id: TENANT_ID, ...m, ativo: true },
    })
    console.log(`  + ${m.descricao}`)
  }
  await db.$disconnect()
  console.log('Motivos criados.')
}

main().catch(e => { console.error(e); process.exit(1) })
