/**
 * Seed de dados de teste — período 26/04 a 25/05/2026
 * Colaboradora: Bianca Scheneider Schmidt
 * Jornada: 08:40–15:00, Seg–Sáb, CALL_CENTER_NR17
 *
 * Situações incluídas:
 *   - Dias normais (sequência completa correta)
 *   - Atrasos
 *   - Saída antecipada
 *   - Horas extras
 *   - Faltas (sem marcação)
 *   - Feriado (01/05 — Dia do Trabalho)
 *   - Pausa NR-17 não realizada (inconsistência)
 *   - Esqueceu de bater saída (inconsistência)
 *   - DSR (domingos — sem marcação)
 */

import { config } from 'dotenv'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'

const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: resolve(__dirname, '../.env') })

import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

const COLABORADORA_ID = 'a01c585a-5770-4ae2-9793-3b0ee1d22992' // Bianca

// ── Helpers ───────────────────────────────────────────────────────────────────

function dt(dateStr: string, timeStr: string): Date {
  // Horários em BRT (UTC-3) → converte para UTC
  const [h, m] = timeStr.split(':').map(Number) as [number, number]
  const d = new Date(`${dateStr}T00:00:00Z`)
  d.setUTCHours(h + 3, m, 0, 0) // BRT+3 = UTC
  return d
}

function calcularHash(params: {
  nsr: bigint; timestampMarcacao: Date; timestampGravacao: Date
  cpf: string; cnpj: string
}): string {
  const pad = (n: number, len = 2) => String(n).padStart(len, '0')
  const fmt = (d: Date) => {
    const y = d.getUTCFullYear(); const mo = pad(d.getUTCMonth()+1)
    const dy = pad(d.getUTCDate()); const h = pad(d.getUTCHours()); const mi = pad(d.getUTCMinutes())
    return `${pad(y,4)}-${mo}-${dy}T${h}:${mi}:00+0000`
  }
  const input = String(params.nsr).padStart(9,'0') + '7' +
    fmt(params.timestampMarcacao) + fmt(params.timestampGravacao) +
    params.cpf + 'WEB' + params.cnpj
  return createHash('sha256').update(input,'utf8').digest('hex')
}

async function alocarNsr(cnpjEstabId: string): Promise<bigint> {
  const result = await db.$queryRaw<[{nsr_contador: bigint}]>`
    UPDATE "CnpjEstabelecimento"
    SET nsr_contador = nsr_contador + 1
    WHERE id = ${cnpjEstabId}::uuid
    RETURNING nsr_contador
  `
  return result[0]!.nsr_contador
}

async function criarMarcacao(params: {
  tipo: string
  data: string
  hora: string
  cnpjEstabId: string
  cnpj: string
  cpf: string
  tenantId: string
}) {
  const ts = dt(params.data, params.hora)
  const nsr = await alocarNsr(params.cnpjEstabId)
  const hash = calcularHash({ nsr, timestampMarcacao: ts, timestampGravacao: ts, cpf: params.cpf, cnpj: params.cnpj })

  await db.marcacao.create({
    data: {
      tenant_id: params.tenantId,
      cnpj_estab_id: params.cnpjEstabId,
      colaborador_id: COLABORADORA_ID,
      nsr,
      timestamp_marcacao: ts,
      timestamp_gravacao: ts,
      tipo: params.tipo as any,
      canal: 'WEB',
      hash_sha256: hash,
      fora_da_area: false,
      fora_da_janela: false,
    }
  })
  console.log(`  ✓ ${params.data} ${params.hora} — ${params.tipo}`)
}

// ── Sequência completa de um dia normal ───────────────────────────────────────
// 08:40 ENTRADA | 09:50 NR17-1 | 10:00 RETORNO | 11:00 INTERVALO | 11:20 RETORNO | 13:10 NR17-2 | 13:20 RETORNO | 15:00 SAIDA

async function diaNormal(data: string, ctx: { cnpjEstabId: string; cnpj: string; cpf: string; tenantId: string }) {
  await criarMarcacao({ tipo: 'ENTRADA',               data, hora: '08:40', ...ctx })
  await criarMarcacao({ tipo: 'SAIDA_PAUSA_NR17',      data, hora: '09:50', ...ctx })
  await criarMarcacao({ tipo: 'RETORNO_PAUSA_NR17',    data, hora: '10:00', ...ctx })
  await criarMarcacao({ tipo: 'SAIDA_INTERVALO',       data, hora: '11:00', ...ctx })
  await criarMarcacao({ tipo: 'RETORNO_INTERVALO',     data, hora: '11:20', ...ctx })
  await criarMarcacao({ tipo: 'SAIDA_PAUSA_NR17',      data, hora: '13:10', ...ctx })
  await criarMarcacao({ tipo: 'RETORNO_PAUSA_NR17',    data, hora: '13:20', ...ctx })
  await criarMarcacao({ tipo: 'SAIDA',                 data, hora: '15:00', ...ctx })
}

async function diaAtraso(data: string, minutosAtraso: number, ctx: { cnpjEstabId: string; cnpj: string; cpf: string; tenantId: string }) {
  const [h, m] = '08:40'.split(':').map(Number) as [number, number]
  const totalMin = h * 60 + m + minutosAtraso
  const hora = `${String(Math.floor(totalMin/60)).padStart(2,'0')}:${String(totalMin%60).padStart(2,'0')}`
  await criarMarcacao({ tipo: 'ENTRADA',               data, hora, ...ctx })
  await criarMarcacao({ tipo: 'SAIDA_PAUSA_NR17',      data, hora: '09:50', ...ctx })
  await criarMarcacao({ tipo: 'RETORNO_PAUSA_NR17',    data, hora: '10:00', ...ctx })
  await criarMarcacao({ tipo: 'SAIDA_INTERVALO',       data, hora: '11:00', ...ctx })
  await criarMarcacao({ tipo: 'RETORNO_INTERVALO',     data, hora: '11:20', ...ctx })
  await criarMarcacao({ tipo: 'SAIDA_PAUSA_NR17',      data, hora: '13:10', ...ctx })
  await criarMarcacao({ tipo: 'RETORNO_PAUSA_NR17',    data, hora: '13:20', ...ctx })
  await criarMarcacao({ tipo: 'SAIDA',                 data, hora: '15:00', ...ctx })
}

async function diaHoraExtra(data: string, minutosHE: number, ctx: { cnpjEstabId: string; cnpj: string; cpf: string; tenantId: string }) {
  const totalMin = 15 * 60 + minutosHE
  const hora = `${String(Math.floor(totalMin/60)).padStart(2,'0')}:${String(totalMin%60).padStart(2,'0')}`
  await criarMarcacao({ tipo: 'ENTRADA',               data, hora: '08:40', ...ctx })
  await criarMarcacao({ tipo: 'SAIDA_PAUSA_NR17',      data, hora: '09:50', ...ctx })
  await criarMarcacao({ tipo: 'RETORNO_PAUSA_NR17',    data, hora: '10:00', ...ctx })
  await criarMarcacao({ tipo: 'SAIDA_INTERVALO',       data, hora: '11:00', ...ctx })
  await criarMarcacao({ tipo: 'RETORNO_INTERVALO',     data, hora: '11:20', ...ctx })
  await criarMarcacao({ tipo: 'SAIDA_PAUSA_NR17',      data, hora: '13:10', ...ctx })
  await criarMarcacao({ tipo: 'RETORNO_PAUSA_NR17',    data, hora: '13:20', ...ctx })
  await criarMarcacao({ tipo: 'SAIDA',                 data, hora,          ...ctx })
}

async function diaSaidaAntecipada(data: string, ctx: { cnpjEstabId: string; cnpj: string; cpf: string; tenantId: string }) {
  await criarMarcacao({ tipo: 'ENTRADA',               data, hora: '08:40', ...ctx })
  await criarMarcacao({ tipo: 'SAIDA_PAUSA_NR17',      data, hora: '09:50', ...ctx })
  await criarMarcacao({ tipo: 'RETORNO_PAUSA_NR17',    data, hora: '10:00', ...ctx })
  await criarMarcacao({ tipo: 'SAIDA_INTERVALO',       data, hora: '11:00', ...ctx })
  await criarMarcacao({ tipo: 'RETORNO_INTERVALO',     data, hora: '11:20', ...ctx })
  await criarMarcacao({ tipo: 'SAIDA',                 data, hora: '14:30', ...ctx }) // saiu 30min antes
}

async function diaSemNR17Segunda(data: string, ctx: { cnpjEstabId: string; cnpj: string; cpf: string; tenantId: string }) {
  // Fez a 1ª NR-17 e o intervalo, mas esqueceu a 2ª NR-17
  await criarMarcacao({ tipo: 'ENTRADA',               data, hora: '08:40', ...ctx })
  await criarMarcacao({ tipo: 'SAIDA_PAUSA_NR17',      data, hora: '09:50', ...ctx })
  await criarMarcacao({ tipo: 'RETORNO_PAUSA_NR17',    data, hora: '10:00', ...ctx })
  await criarMarcacao({ tipo: 'SAIDA_INTERVALO',       data, hora: '11:00', ...ctx })
  await criarMarcacao({ tipo: 'RETORNO_INTERVALO',     data, hora: '11:20', ...ctx })
  await criarMarcacao({ tipo: 'SAIDA',                 data, hora: '15:00', ...ctx }) // sem 2ª NR-17
}

async function diaEsqueceuSaida(data: string, ctx: { cnpjEstabId: string; cnpj: string; cpf: string; tenantId: string }) {
  // Bateu entrada e pausas mas esqueceu de bater saída
  await criarMarcacao({ tipo: 'ENTRADA',               data, hora: '08:40', ...ctx })
  await criarMarcacao({ tipo: 'SAIDA_PAUSA_NR17',      data, hora: '09:50', ...ctx })
  await criarMarcacao({ tipo: 'RETORNO_PAUSA_NR17',    data, hora: '10:00', ...ctx })
  await criarMarcacao({ tipo: 'SAIDA_INTERVALO',       data, hora: '11:00', ...ctx })
  await criarMarcacao({ tipo: 'RETORNO_INTERVALO',     data, hora: '11:20', ...ctx })
  // sem SAIDA_PAUSA_NR17 2ª nem SAIDA
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const colaboradora = await db.colaborador.findUniqueOrThrow({
    where: { id: COLABORADORA_ID },
    include: { cnpj_estab: true },
  })
  const ctx = {
    cnpjEstabId: colaboradora.cnpj_estab_id,
    cnpj: colaboradora.cnpj_estab.cnpj,
    cpf: colaboradora.cpf,
    tenantId: colaboradora.tenant_id,
  }

  console.log(`\nSeed de dados — período 26/04 a 25/05/2026`)
  console.log(`Colaboradora: ${colaboradora.nome_completo} | CPF: ${ctx.cpf}`)
  console.log(`CNPJ: ${ctx.cnpj}\n`)

  // ── ABRIL ─────────────────────────────────────────────────────────────────
  console.log('── Abril ──')
  console.log('26/04 (Sáb) — Dia normal')
  await diaNormal('2026-04-26', ctx)

  console.log('27/04 (Dom) — DSR (sem marcação)')

  console.log('28/04 (Seg) — Dia normal')
  await diaNormal('2026-04-28', ctx)

  console.log('29/04 (Ter) — Atraso 15min')
  await diaAtraso('2026-04-29', 15, ctx)

  console.log('30/04 (Qua) — Dia normal')
  await diaNormal('2026-04-30', ctx)

  // ── MAIO ──────────────────────────────────────────────────────────────────
  console.log('\n── Maio ──')
  console.log('01/05 (Qui) — FERIADO Dia do Trabalho (sem marcação)')

  console.log('02/05 (Sex) — Dia normal')
  await diaNormal('2026-05-02', ctx)

  console.log('03/05 (Sáb) — HE 30min')
  await diaHoraExtra('2026-05-03', 30, ctx)

  console.log('04/05 (Dom) — DSR (sem marcação)')

  console.log('05/05 (Seg) — Dia normal')
  await diaNormal('2026-05-05', ctx)

  console.log('06/05 (Ter) — Dia normal')
  await diaNormal('2026-05-06', ctx)

  console.log('07/05 (Qua) — Atraso 20min')
  await diaAtraso('2026-05-07', 20, ctx)

  console.log('08/05 (Qui) — Saída antecipada 30min')
  await diaSaidaAntecipada('2026-05-08', ctx)

  console.log('09/05 (Sex) — Dia normal')
  await diaNormal('2026-05-09', ctx)

  console.log('10/05 (Sáb) — Dia normal')
  await diaNormal('2026-05-10', ctx)

  console.log('11/05 (Dom) — DSR (sem marcação)')

  console.log('12/05 (Seg) — Dia normal')
  await diaNormal('2026-05-12', ctx)

  console.log('13/05 (Ter) — Esqueceu saída (inconsistência)')
  await diaEsqueceuSaida('2026-05-13', ctx)

  console.log('14/05 (Qua) — HE 45min')
  await diaHoraExtra('2026-05-14', 45, ctx)

  console.log('15/05 (Qui) — FALTA (sem marcação)')

  console.log('16/05 (Sex) — Atraso 25min')
  await diaAtraso('2026-05-16', 25, ctx)

  console.log('17/05 (Sáb) — NR-17 2ª pausa não realizada (inconsistência)')
  await diaSemNR17Segunda('2026-05-17', ctx)

  console.log('18/05 (Dom) — DSR (sem marcação)')

  console.log('19/05 (Seg) — Dia normal')
  await diaNormal('2026-05-19', ctx)

  console.log('20/05 (Ter) — HE 60min')
  await diaHoraExtra('2026-05-20', 60, ctx)

  console.log('21/05 (Qua) — Dia normal')
  await diaNormal('2026-05-21', ctx)

  console.log('22/05 (Qui) — Dia normal')
  await diaNormal('2026-05-22', ctx)

  console.log('23/05 (Sex) — FALTA (sem marcação)')

  console.log('24/05 (Sáb) — Dia normal')
  await diaNormal('2026-05-24', ctx)

  console.log('25/05 (Dom) — DSR (sem marcação)')

  console.log('\n✓ Seed concluído!')
  console.log('\nResumo das situações inseridas:')
  console.log('  Dias normais:            12')
  console.log('  Atrasos:                  3 (15, 20, 25 min)')
  console.log('  Horas extras:             3 (30, 45, 60 min)')
  console.log('  Saída antecipada:         1')
  console.log('  Falta:                    2')
  console.log('  Feriado (01/05):          1')
  console.log('  DSR (domingos):           4')
  console.log('  Esqueceu saída:           1')
  console.log('  NR-17 2ª pausa ausente:   1')
}

main()
  .catch((e) => { console.error('Erro:', e.message); process.exit(1) })
  .finally(() => db.$disconnect())
