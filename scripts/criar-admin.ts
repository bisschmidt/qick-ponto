/**
 * Script de seed — cria o primeiro tenant + admin para a Pessoalize.
 * Rode uma única vez: pnpm tsx scripts/criar-admin.ts
 */

import { config } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { scrypt, randomBytes } from 'node:crypto'
import { promisify } from 'node:util'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '../.env') })

import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()
const scryptAsync = promisify(scrypt)

async function hashSenha(senha: string): Promise<string> {
  const salt = randomBytes(16)
  const hash = (await scryptAsync(senha, salt, 64)) as Buffer
  return `${salt.toString('hex')}:${hash.toString('hex')}`
}

// ─── CONFIGURAÇÃO ─────────────────────────────────────────────────────────────
// Edite aqui antes de rodar

const CONFIG = {
  // Tenant / empresa
  razaoSocial:   'Pessoalize',

  // CNPJ do estabelecimento (14 dígitos, sem pontuação)
  cnpj:          '32502582000109',
  uf:            'SP',
  fusoHorario:   'America/Sao_Paulo',
  endereco:      'São Paulo, SP',

  // Admin inicial
  nomeAdmin:     'Joseph Kulman',
  cpfAdmin:      '04754374975',
  pisAdmin:      '13030466727',
  emailAdmin:    'joseph@pessoalize.com',
  senhaAdmin:    '@Filhas17',
  matriculaAdmin: 'ADM001',
}

// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Criando tenant e admin...\n')

  // 1. Tenant
  const tenant = await db.tenant.create({
    data: { razao_social: CONFIG.razaoSocial },
  })
  console.log(`✓ Tenant: ${tenant.razao_social} (${tenant.id})`)

  // 2. CNPJ / estabelecimento
  const cnpj = await db.cnpjEstabelecimento.create({
    data: {
      tenant_id:    tenant.id,
      cnpj:         CONFIG.cnpj,
      razao_social: CONFIG.razaoSocial,
      uf:           CONFIG.uf,
      fuso_horario: CONFIG.fusoHorario,
      endereco:     CONFIG.endereco,
    },
  })
  console.log(`✓ Estabelecimento: ${cnpj.cnpj}`)

  // 3. Colaborador admin
  const colaborador = await db.colaborador.create({
    data: {
      tenant_id:        tenant.id,
      cnpj_estab_id:    cnpj.id,
      nome_completo:    CONFIG.nomeAdmin,
      cpf:              CONFIG.cpfAdmin,
      pis_nit:          CONFIG.pisAdmin,
      matricula:        CONFIG.matriculaAdmin,
      regime:           'CLT',
      data_admissao:    new Date(),
      centro_custo:     'Administração',
      operacao_cliente: 'Interno',
      email_corporativo: CONFIG.emailAdmin,
      onboarding_ok:    true,
    },
  })
  console.log(`✓ Colaborador: ${colaborador.nome_completo}`)

  // 4. Usuário com perfil ADMIN_TENANT
  const senhaHash = await hashSenha(CONFIG.senhaAdmin)
  const usuario = await db.usuario.create({
    data: {
      colaborador_id: colaborador.id,
      tenant_id:      tenant.id,
      perfil:         'ADMIN_TENANT',
      senha_hash:     senhaHash,
    },
  })
  console.log(`✓ Usuário criado (perfil: ${usuario.perfil})`)

  console.log(`
────────────────────────────────────────
  Pronto! Acesse http://localhost:3001

  Email: ${CONFIG.emailAdmin}
  Senha: ${CONFIG.senhaAdmin}

  Tenant ID: ${tenant.id}
────────────────────────────────────────
  `)
}

main()
  .catch((e) => { console.error('Erro:', e); process.exit(1) })
  .finally(() => db.$disconnect())
