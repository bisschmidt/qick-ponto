// Gravação de marcação com lastro fiscal — compartilhado entre o ponto normal (M2)
// e o ponto de Hora Extra (módulo he). Garante NSR, hash, registro AFD tipo 7 e CRPT
// idênticos para qualquer origem de marcação.

import type { PrismaClient, TipoMarcacao } from '@prisma/client'
import type { Queue } from 'bullmq'
import { alocarNsr } from './nsr.js'
import { calcularHashMarcacao } from './hash.js'

export interface PersistirMarcacaoParams {
  tenantId: string
  cnpjEstab: { id: string; cnpj: string }
  colaborador: { id: string; cpf: string }
  tipo: TipoMarcacao
  canal: string
  timestampDevice?: string | Date | null
  imagemRef?: string | null
  latitude?: number | null
  longitude?: number | null
  foraArea?: boolean
  foraJanela?: boolean
}

export async function persistirMarcacao(
  db: PrismaClient,
  crptQueue: Queue | null,
  params: PersistirMarcacaoParams,
) {
  const { tenantId, cnpjEstab, colaborador, tipo, canal } = params

  const timestampGravacao = new Date()
  const timestampMarcacao = params.timestampDevice
    ? new Date(params.timestampDevice)
    : timestampGravacao

  const nsr = await alocarNsr(db, cnpjEstab.id)

  const hashSha256 = calcularHashMarcacao({
    nsr,
    timestampMarcacao,
    timestampGravacao,
    cpf: colaborador.cpf,
    idColetor: canal,
    cnpj: cnpjEstab.cnpj,
  })

  const marcacao = await db.marcacao.create({
    data: {
      tenant_id: tenantId,
      cnpj_estab_id: cnpjEstab.id,
      colaborador_id: colaborador.id,
      nsr,
      timestamp_marcacao: timestampMarcacao,
      timestamp_gravacao: timestampGravacao,
      tipo,
      canal: canal as never,
      hash_sha256: hashSha256,
      imagem_ref: params.imagemRef ?? null,
      latitude: params.latitude ?? null,
      longitude: params.longitude ?? null,
      fora_da_area: params.foraArea ?? false,
      fora_da_janela: params.foraJanela ?? false,
    },
  })

  await db.afdRegistro.create({
    data: {
      cnpj_estab_id: cnpjEstab.id,
      nsr,
      tipo_registro: 7,
      conteudo_raw: montarRegistroTipo7({
        nsr,
        timestampMarcacao,
        timestampGravacao,
        cpf: colaborador.cpf,
        canal,
        cnpj: cnpjEstab.cnpj,
        hashSha256,
      }),
    },
  })

  if (crptQueue) {
    await crptQueue.add('generate-crpt', { marcacaoId: marcacao.id })
  }

  return { marcacao, nsr, hashSha256, timestampMarcacao }
}

export function montarRegistroTipo7(params: {
  nsr: bigint
  timestampMarcacao: Date
  timestampGravacao: Date
  cpf: string
  canal: string
  cnpj: string
  hashSha256: string
}): string {
  const { nsr, timestampMarcacao, timestampGravacao, cpf, canal, cnpj, hashSha256 } = params

  const pad = (s: string, len: number) => s.padEnd(len, ' ')
  const padNum = (n: string, len: number) => n.padStart(len, '0')
  const fmtDH = (d: Date) => {
    const z = (n: number) => String(n).padStart(2, '0')
    return `${d.getUTCFullYear()}-${z(d.getUTCMonth() + 1)}-${z(d.getUTCDate())}T${z(d.getUTCHours())}:${z(d.getUTCMinutes())}:00+0000`
  }

  return (
    padNum(String(nsr), 9) +
    '7' +
    fmtDH(timestampMarcacao) +
    fmtDH(timestampGravacao) +
    padNum(cpf, 11) +
    pad(canal, 30) +
    padNum(cnpj, 12) +
    hashSha256 // 64 chars
  )
}
