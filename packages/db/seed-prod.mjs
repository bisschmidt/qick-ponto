import { PrismaClient } from '@prisma/client'
import { randomBytes, scrypt, timingSafeEqual } from 'crypto'
import { promisify } from 'util'

const scryptAsync = promisify(scrypt)

const db = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } }
})

async function hashPassword(password) {
  const salt = randomBytes(16)
  const hash = await scryptAsync(password, salt, 64)
  return `${salt.toString('hex')}:${hash.toString('hex')}`
}

async function main() {
  const tenantId = '00000000-0000-0000-0000-000000000001'

  const tenant = await db.tenant.upsert({
    where: { id: tenantId },
    update: {},
    create: {
      id: tenantId,
      razao_social: 'Pessoalize',
      plano: 'pilot',
    }
  })
  console.log('Tenant:', tenant.id)

  await db.cnpjEstabelecimento.upsert({
    where: { cnpj: '12345678000100' },
    update: {},
    create: {
      tenant_id: tenantId,
      cnpj: '12345678000100',
      razao_social: 'Pessoalize Ltda',
      uf: 'SC',
      fuso_horario: 'America/Sao_Paulo',
      endereco: 'Florianópolis, SC',
    }
  })
  console.log('CNPJ criado')

  // Busca o ID do CNPJ criado
  const cnpjEstab = await db.cnpjEstabelecimento.findUniqueOrThrow({ where: { cnpj: '12345678000100' } })

  const admin = await db.colaborador.upsert({
    where: { id: '00000000-0000-0000-0000-000000000002' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000002',
      tenant_id: tenantId,
      cnpj_estab_id: cnpjEstab.id,
      nome_completo: 'Joseph Admin',
      cpf: '00000000000',
      pis_nit: '00000000000',
      matricula: 'ADM001',
      regime: 'CLT',
      data_admissao: new Date('2024-01-01'),
      centro_custo: 'Admin',
      operacao_cliente: 'Admin',
      email_corporativo: 'joseph@pessoalize.com',
      ativo: true,
      onboarding_ok: true,
    }
  })
  console.log('Admin colaborador:', admin.id)

  const senhaHash = await hashPassword('Admin@2026')
  await db.usuario.upsert({
    where: { colaborador_id: admin.id },
    update: { senha_hash: senhaHash },
    create: {
      colaborador_id: admin.id,
      tenant_id: tenantId,
      perfil: 'ADMIN_TENANT',
      senha_hash: senhaHash,
    }
  })
  console.log('Usuario admin criado — email: joseph@pessoalize.com  senha: Admin@2026')

  await db.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
