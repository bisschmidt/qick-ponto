import { config } from 'dotenv'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
config({ path: resolve(__dirname, '../../../.env') })

import { Worker } from 'bullmq'
import { PrismaClient } from '@prisma/client'
import { gerarCrptPdf } from '@qick/pdf'

const REDIS_URL = process.env['REDIS_URL']
if (!REDIS_URL) {
  console.error('[worker] REDIS_URL não configurado — encerrando')
  process.exit(1)
}

const db = new PrismaClient()

const workerCrpt = new Worker(
  'crpt',
  async (job) => {
    const { marcacaoId } = job.data as { marcacaoId: string }

    const marcacao = await db.marcacao.findUnique({
      where: { id: marcacaoId },
      include: {
        colaborador: true,
        cnpj_estab: true,
      },
    })

    if (!marcacao) throw new Error(`Marcação ${marcacaoId} não encontrada`)
    if (marcacao.crpt_gerado) {
      console.log(`[worker:crpt] CRPT já gerado para ${marcacaoId} — ignorando`)
      return
    }

    const pdfBuffer = await gerarCrptPdf({
      nsr: marcacao.nsr,
      timestampMarcacao: marcacao.timestamp_marcacao,
      tipo: marcacao.tipo,
      canal: marcacao.canal,
      hashSha256: marcacao.hash_sha256,
      nomeColaborador: marcacao.colaborador.nome_completo,
      cpf: marcacao.colaborador.cpf,
      pis: marcacao.colaborador.pis_nit,
      matricula: marcacao.colaborador.matricula,
      razaoSocial: marcacao.cnpj_estab.razao_social,
      cnpj: marcacao.cnpj_estab.cnpj,
      fusoHorario: marcacao.cnpj_estab.fuso_horario,
    })

    let crptUrl: string

    if (process.env['S3_BUCKET'] && process.env['S3_ENDPOINT']) {
      crptUrl = `s3://${process.env['S3_BUCKET']}/crpt/${marcacao.cnpj_estab.cnpj}/${marcacao.nsr}.pdf`
    } else {
      crptUrl = `local://crpt/${marcacao.cnpj_estab.cnpj}/${marcacao.nsr}.pdf`
      console.log(`[worker:crpt] PDF gerado em memória (${pdfBuffer.length} bytes) — S3 não configurado`)
    }

    await db.marcacao.update({
      where: { id: marcacaoId },
      data: { crpt_gerado: true, crpt_url: crptUrl },
    })

    console.log(`[worker:crpt] CRPT gerado — NSR ${marcacao.nsr} | ${crptUrl}`)
  },
  {
    connection: { url: REDIS_URL } as never,
    concurrency: 20,
  },
)

workerCrpt.on('failed', (job, err) => {
  console.error(`[worker:crpt] Job ${job?.id} falhou:`, err.message)
})

process.on('SIGTERM', async () => {
  await workerCrpt.close()
  await db.$disconnect()
  process.exit(0)
})

console.log('[worker] Iniciado — aguardando jobs BullMQ (Upstash Redis)...')
