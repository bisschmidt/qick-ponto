import { PrismaClient } from '@prisma/client'
import { createHash } from 'crypto'

const DB_URL = 'postgresql://postgres:EMYquNeYVHUxUozGnhUAQtzQlYyIUfNl@crossover.proxy.rlwy.net:46498/railway'
const db = new PrismaClient({ datasources: { db: { url: DB_URL } } })

const TENANT_ID = '00000000-0000-0000-0000-000000000001'

function ts(dateStr, timeStr) {
  return new Date(`${dateStr}T${timeStr}:00-03:00`)
}

const pad = (s, len) => String(s).padEnd(len, ' ')
const padNum = (n, len) => String(n).padStart(len, '0')

function fmtDH(d) {
  const z = (n) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}-${z(d.getUTCMonth() + 1)}-${z(d.getUTCDate())}T${z(d.getUTCHours())}:${z(d.getUTCMinutes())}:00+0000`
}

function calcularHash({ nsr, timestampMarcacao, timestampGravacao, cpf, canal, cnpj }) {
  const registro =
    padNum(String(nsr), 9) +
    '7' +
    fmtDH(timestampMarcacao) +
    fmtDH(timestampGravacao) +
    padNum(cpf, 11) +
    pad(canal, 30) +
    padNum(cnpj, 12)
  return createHash('sha256').update(registro).digest('hex')
}

const DIAS = [
  '2026-06-01','2026-06-02','2026-06-03','2026-06-04','2026-06-05','2026-06-06',
  '2026-06-08','2026-06-09','2026-06-10','2026-06-11','2026-06-12','2026-06-13',
  '2026-06-15','2026-06-16','2026-06-17','2026-06-18','2026-06-19','2026-06-20',
]

async function main() {
  // Limpa marcações de teste anteriores
  const removidas = await db.marcacao.deleteMany({
    where: { tenant_id: TENANT_ID, timestamp_gravacao: { gte: new Date('2026-06-22') } },
  })
  console.log(`Removidas ${removidas.count} marcações inválidas`)

  // Reset do contador de NSR (sequência por CNPJ) para começar limpo
  await db.$executeRaw`UPDATE "Marcacao" SET nsr = nsr WHERE false` // noop, pra garantir conexão

  const cnpjEstab = await db.cnpjEstabelecimento.findFirstOrThrow({ where: { tenant_id: TENANT_ID } })

  const colabs = await db.colaborador.findMany({
    where: { tenant_id: TENANT_ID, matricula: { startsWith: 'CC' } },
    orderBy: { matricula: 'asc' },
  })

  const byMat = Object.fromEntries(colabs.map(c => [c.matricula, c]))
  const faltas = {
    CC003: new Set(['2026-06-10', '2026-06-17']),
    CC005: new Set(['2026-06-15']),
  }

  // Pega último NSR existente
  const ultimo = await db.marcacao.findFirst({
    where: { cnpj_estab_id: cnpjEstab.id },
    orderBy: { nsr: 'desc' },
  })
  let nsr = ultimo ? BigInt(ultimo.nsr) + 1n : 1n

  const eventos = [] // { colaborador, dia, hora, tipo }
  function add(mat, dia, hora, tipo) {
    eventos.push({ colaborador: byMat[mat], dia, hora, tipo })
  }

  function diaCompleto(mat, dia, opts = {}) {
    const { entrada = '08:00', saida = '14:00', falta = false } = opts
    if (falta) return
    add(mat, dia, entrada, 'ENTRADA')
    add(mat, dia, '10:00', 'SAIDA_PAUSA_NR17')
    add(mat, dia, '10:10', 'RETORNO_PAUSA_NR17')
    add(mat, dia, '12:00', 'SAIDA_PAUSA_NR17')
    add(mat, dia, '12:10', 'RETORNO_PAUSA_NR17')
    add(mat, dia, saida, 'SAIDA')
  }

  for (const dia of DIAS) {
    diaCompleto('CC001', dia)
    diaCompleto('CC002', dia, { entrada: '07:30', saida: '15:00' })
    diaCompleto('CC003', dia, { falta: faltas.CC003.has(dia) })
    diaCompleto('CC004', dia, { entrada: '08:15' })
    diaCompleto('CC005', dia, { falta: faltas.CC005.has(dia), entrada: '07:45', saida: '14:30' })
  }

  // Ordena por timestamp (NSR é sequencial cronológico por CNPJ)
  eventos.sort((a, b) => ts(a.dia, a.hora) - ts(b.dia, b.hora))

  console.log(`Inserindo ${eventos.length} marcações...`)
  const gravacao = new Date('2026-06-21T12:00:00Z')

  for (const ev of eventos) {
    const timestampMarcacao = ts(ev.dia, ev.hora)
    const hash = calcularHash({
      nsr,
      timestampMarcacao,
      timestampGravacao: gravacao,
      cpf: ev.colaborador.cpf,
      canal: 'WEB',
      cnpj: cnpjEstab.cnpj,
    })

    await db.marcacao.create({
      data: {
        tenant_id: TENANT_ID,
        cnpj_estab_id: cnpjEstab.id,
        colaborador_id: ev.colaborador.id,
        nsr,
        timestamp_marcacao: timestampMarcacao,
        timestamp_gravacao: gravacao,
        tipo: ev.tipo,
        canal: 'WEB',
        hash_sha256: hash,
      },
    })
    nsr++
  }

  // Limpa apurações antigas (estavam erradas)
  const apurDel = await db.jornadaApurada.deleteMany({
    where: { tenant_id: TENANT_ID, data_referencia: { gte: new Date('2026-06-01'), lte: new Date('2026-06-30') } },
  })
  console.log(`Removidas ${apurDel.count} apurações antigas`)

  await db.$disconnect()
  console.log('Pronto! Reapure no painel.')
}

main().catch(e => { console.error(e); process.exit(1) })
