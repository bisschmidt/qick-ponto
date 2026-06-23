import { PrismaClient } from '@prisma/client'
import { scrypt, randomBytes } from 'crypto'
import { promisify } from 'util'

const scryptAsync = promisify(scrypt)
const DB_URL = 'postgresql://postgres:EMYquNeYVHUxUozGnhUAQtzQlYyIUfNl@crossover.proxy.rlwy.net:46498/railway'
const BASE = 'https://qick-ponto-api-production.up.railway.app/v1'
const db = new PrismaClient({ datasources: { db: { url: DB_URL } } })

async function hashSenha(senha) {
  const salt = randomBytes(16)
  const hash = await scryptAsync(senha, salt, 64)
  return `${salt.toString('hex')}:${hash.toString('hex')}`
}

async function apiLogin(email, senha) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, senha }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(`Login ${email}: ${JSON.stringify(json)}`)
  return json.token
}

async function apiPost(path, body, token) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`POST ${path} -> ${res.status}: ${JSON.stringify(json)}`)
  return json
}

function ts(dateStr, timeStr) {
  return new Date(`${dateStr}T${timeStr}:00-03:00`).toISOString()
}

const DIAS = [
  '2026-06-01','2026-06-02','2026-06-03','2026-06-04','2026-06-05','2026-06-06',
  '2026-06-08','2026-06-09','2026-06-10','2026-06-11','2026-06-12','2026-06-13',
  '2026-06-15','2026-06-16','2026-06-17','2026-06-18','2026-06-19','2026-06-20',
]

async function diaCompleto(token, data, opts) {
  const { entrada = '08:00', saida = '14:00', falta = false } = opts || {}
  if (falta) return
  await apiPost('/marcacoes', { timestamp_marcacao: ts(data, entrada),  tipo: 'ENTRADA',            canal: 'WEB' }, token)
  await apiPost('/marcacoes', { timestamp_marcacao: ts(data, '10:00'),  tipo: 'SAIDA_PAUSA_NR17',   canal: 'WEB' }, token)
  await apiPost('/marcacoes', { timestamp_marcacao: ts(data, '10:12'),  tipo: 'RETORNO_PAUSA_NR17', canal: 'WEB' }, token)
  await apiPost('/marcacoes', { timestamp_marcacao: ts(data, '12:00'),  tipo: 'SAIDA_PAUSA_NR17',   canal: 'WEB' }, token)
  await apiPost('/marcacoes', { timestamp_marcacao: ts(data, '12:12'),  tipo: 'RETORNO_PAUSA_NR17', canal: 'WEB' }, token)
  await apiPost('/marcacoes', { timestamp_marcacao: ts(data, saida),    tipo: 'SAIDA',              canal: 'WEB' }, token)
}

async function main() {
  const tenantId = '00000000-0000-0000-0000-000000000001'
  const senha = 'Ponto@2026'
  const emails = {
    '12345678901': 'bianca@pessoalize.com',
    '23456789012': 'carlos@pessoalize.com',
    '34567890123': 'maria@pessoalize.com',
    '45678901234': 'joao@pessoalize.com',
    '56789012345': 'ana@pessoalize.com',
  }

  const colabs = await db.colaborador.findMany({
    where: { tenant_id: tenantId, cpf: { in: Object.keys(emails) } },
    orderBy: { matricula: 'asc' },
  })
  console.log(`Colaboradores encontrados: ${colabs.length}`)

  const tokens = {}
  for (const c of colabs) {
    const email = emails[c.cpf]
    const senhaHash = await hashSenha(senha)
    const existente = await db.usuario.findUnique({ where: { colaborador_id: c.id } })
    if (existente) {
      await db.usuario.update({ where: { id: existente.id }, data: { senha_hash: senhaHash, ativo: true } })
    } else {
      await db.usuario.create({
        data: { colaborador_id: c.id, tenant_id: tenantId, perfil: 'COLABORADOR', senha_hash: senhaHash, ativo: true }
      })
    }
    await db.colaborador.update({ where: { id: c.id }, data: { onboarding_ok: true } })
    const aceite = await db.aceiteLgpd.findUnique({ where: { colaborador_id: c.id } })
    if (!aceite) {
      await db.aceiteLgpd.create({
        data: { colaborador_id: c.id, ip: "127.0.0.1", versao_aviso: "1.0", timestamp_aceite: new Date() }
      })
    }
    tokens[c.matricula] = await apiLogin(email, senha)
    console.log(`  ${c.nome_completo} (${c.matricula}) -- OK`)
  }

  const jaTemMarcacoes = await db.marcacao.count({
    where: { tenant_id: tenantId, timestamp_marcacao: { gte: new Date('2026-06-01') } }
  })
  if (jaTemMarcacoes > 0) {
    console.log(`\nJa existem ${jaTemMarcacoes} marcacoes -- pulando.`)
    await db.$disconnect()
    return
  }

  const faltas = {
    CC003: new Set(['2026-06-10', '2026-06-17']),
    CC005: new Set(['2026-06-15']),
  }

  console.log('\nCriando marcacoes...')
  for (const dia of DIAS) {
    process.stdout.write(`  ${dia} `)
    await diaCompleto(tokens['CC001'], dia)
    await diaCompleto(tokens['CC002'], dia, { entrada: '07:30', saida: '15:00' })
    await diaCompleto(tokens['CC003'], dia, { falta: faltas['CC003'].has(dia) })
    await diaCompleto(tokens['CC004'], dia, { entrada: '08:15' })
    await diaCompleto(tokens['CC005'], dia, { falta: faltas['CC005'].has(dia), entrada: '07:45', saida: '14:30' })
    console.log('v')
  }

  await db.$disconnect()
  console.log('\nPronto!')
  console.log('  CC001 Bianca -- normal')
  console.log('  CC002 Carlos -- HE todos os dias')
  console.log('  CC003 Maria  -- 2 faltas (10/06, 17/06)')
  console.log('  CC004 Joao   -- atraso 15min/dia')
  console.log('  CC005 Ana    -- 1 falta (15/06) + HE leve')
  console.log('Senha de todos: ' + senha)
}

main().catch(e => { console.error('ERRO:', e.message); process.exit(1) })
