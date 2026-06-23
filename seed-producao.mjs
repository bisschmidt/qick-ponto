/**
 * Seed de produção — cria colaboradores e marcações de teste
 * Situações para testar fechamento:
 *  Bianca — normal (sem ocorrências)
 *  Carlos — HE todos os dias (+90min por dia)
 *  Maria  — 2 faltas (10/06 e 17/06)
 *  João   — atraso de 15min todo dia
 *  Ana    — 1 falta (15/06) + HE leve nos outros dias
 */

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
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, senha }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(`Login ${email} falhou: ${JSON.stringify(json)}`)
  return json.token
}

async function apiPost(path, body, token) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`POST ${path} → ${res.status}: ${JSON.stringify(json)}`)
  return json
}

function ts(dateStr, timeStr) {
  return new Date(`${dateStr}T${timeStr}:00-03:00`).toISOString()
}

// Dias úteis seg-sab de junho 2026 (1-20)
const DIAS = [
  '2026-06-01','2026-06-02','2026-06-03','2026-06-04','2026-06-05','2026-06-06',
  '2026-06-08','2026-06-09','2026-06-10','2026-06-11','2026-06-12','2026-06-13',
  '2026-06-15','2026-06-16','2026-06-17','2026-06-18','2026-06-19','2026-06-20',
]

async function diaCompleto(token, data, { entrada = '08:00', saida = '14:00', falta = false } = {}) {
  if (falta) return
  await apiPost('/marcacoes', { timestamp_marcacao: ts(data, entrada), tipo: 'ENTRADA',           canal: 'WEB' }, token)
  await apiPost('/marcacoes', { timestamp_marcacao: ts(data, '10:00'), tipo: 'SAIDA_PAUSA_NR17',  canal: 'WEB' }, token)
  await apiPost('/marcacoes', { timestamp_marcacao: ts(data, '10:12'), tipo: 'RETORNO_PAUSA_NR17',canal: 'WEB' }, token)
  await apiPost('/marcacoes', { timestamp_marcacao: ts(data, '12:00'), tipo: 'SAIDA_PAUSA_NR17',  canal: 'WEB' }, token)
  await apiPost('/marcacoes', { timestamp_marcacao: ts(data, '12:12'), tipo: 'RETORNO_PAUSA_NR17',canal: 'WEB' }, token)
  await apiPost('/marcacoes', { timestamp_marcacao: ts(data, saida),   tipo: 'SAIDA',             canal: 'WEB' }, token)
}

async function main() {
  const tenantId = '00000000-0000-0000-0000-000000000001'
  const senha = 'Ponto@2026'

  // Busca dados do banco
  const cnpjEstab = await db.cnpjEstabelecimento.findFirstOrThrow({ where: { tenant_id: tenantId } })
  console.log(`CNPJ estab: ${cnpjEstab.id}`)

  // Token admin para criar jornada e colaboradores
  const adminToken = await apiLogin('joseph@pessoalize.com', 'Admin@2026')

  // ── Jornada ──────────────────────────────────────────────────────────────
  console.log('\nCriando jornada...')
  const jornada = await apiPost('/jornadas', {
    nome: 'Call Center NR-17 6h',
    tipo: 'CALL_CENTER_NR17',
    hora_inicio: '08:00',
    hora_fim: '14:00',
    dias_semana: [1,2,3,4,5,6],
    tolerancia_atraso_entrada: 5,
    tolerancia_atraso_intervalo: 5,
    tolerancia_antec_saida: 5,
    tolerancia_antec_inicio_interv: 5,
    janela_marcacao_min: 30,
    pausas: [
      { nome: 'Pausa NR-17 #1', ordem: 1, duracao_min: 10, eh_nr17: true, computa_jornada: true, janela_inicio_min: 100, janela_fim_min: 160 },
      { nome: 'Pausa NR-17 #2', ordem: 2, duracao_min: 10, eh_nr17: true, computa_jornada: true, janela_inicio_min: 220, janela_fim_min: 300 },
    ],
  }, adminToken)
  console.log(`  → Jornada: ${jornada.id}`)

  // ── Colaboradores ────────────────────────────────────────────────────────
  const colabs = [
    { nome: 'Bianca Scheneider Schmidt', cpf: '12345678901', pis: '12345678901', mat: 'CC001', email: 'bianca@pessoalize.com' },
    { nome: 'Carlos Eduardo Silva',      cpf: '23456789012', pis: '23456789012', mat: 'CC002', email: 'carlos@pessoalize.com' },
    { nome: 'Maria das Graças Oliveira', cpf: '34567890123', pis: '34567890123', mat: 'CC003', email: 'maria@pessoalize.com'  },
    { nome: 'João Paulo Ferreira',       cpf: '45678901234', pis: '45678901234', mat: 'CC004', email: 'joao@pessoalize.com'   },
    { nome: 'Ana Beatriz Costa',         cpf: '56789012345', pis: '56789012345', mat: 'CC005', email: 'ana@pessoalize.com'    },
  ]

  console.log('\nCriando colaboradores e usuários...')
  const tokens = {}

  for (const c of colabs) {
    const colab = await apiPost('/colaboradores', {
      cnpj_estab_id: cnpjEstab.id,
      nome_completo: c.nome,
      cpf: c.cpf,
      pis_nit: c.pis,
      matricula: c.mat,
      regime: 'CLT',
      data_admissao: '2025-01-01',
      centro_custo: 'Atendimento',
      operacao_cliente: 'Pessoalize',
      email_corporativo: c.email,
      tipo_jornada_id: jornada.id,
    }, adminToken)
    console.log(`  → ${c.nome}: ${colab.id}`)

    // Cria Usuario com senha via banco direto
    await db.usuario.create({
      data: {
        colaborador_id: colab.id,
        tenant_id: tenantId,
        perfil: 'COLABORADOR',
        senha_hash: await hashSenha(senha),
        ativo: true,
      }
    })

    // Marca onboarding_ok e cria aceite LGPD direto no banco
    await db.colaborador.update({
      where: { id: colab.id },
      data: { onboarding_ok: true },
    })
    await db.aceiteLgpd.create({
      data: {
        colaborador_id: colab.id,
        tenant_id: tenantId,
        ip: '127.0.0.1',
        user_agent: 'seed',
        versao_politica: '1.0',
      }
    })

    // Login como o colaborador para criar marcações
    tokens[c.mat] = await apiLogin(c.email, senha)
  }

  // ── Marcações ──────────────────────────────────────────────────────────
  const faltas = {
    CC003: new Set(['2026-06-10', '2026-06-17']),
    CC005: new Set(['2026-06-15']),
  }

  console.log('\nCriando marcações...')
  for (const dia of DIAS) {
    process.stdout.write(`  ${dia} `)
    await diaCompleto(tokens['CC001'], dia)                                                // Bianca: normal
    await diaCompleto(tokens['CC002'], dia, { entrada: '07:30', saida: '15:00' })          // Carlos: HE
    await diaCompleto(tokens['CC003'], dia, { falta: faltas['CC003'].has(dia) })           // Maria: faltas
    await diaCompleto(tokens['CC004'], dia, { entrada: '08:15' })                          // João: atraso
    await diaCompleto(tokens['CC005'], dia, { falta: faltas['CC005'].has(dia), entrada: '07:45', saida: '14:30' }) // Ana: misto
    console.log('✓')
  }

  await db.$disconnect()
  console.log('\n✅ Concluído!')
  console.log('\nSituações para testar no fechamento:')
  console.log('  CC001 Bianca  — normal, sem ocorrências')
  console.log('  CC002 Carlos  — HE todos os dias (entrada 07:30, saída 15:00)')
  console.log('  CC003 Maria   — 2 faltas (10/06 e 17/06)')
  console.log('  CC004 João    — atraso de 15min todo dia (entrada 08:15)')
  console.log('  CC005 Ana     — 1 falta (15/06) + HE leve nos outros dias')
  console.log(`\nSenha de todos os colaboradores: ${senha}`)
}

main().catch(e => { console.error('ERRO:', e.message); process.exit(1) })
