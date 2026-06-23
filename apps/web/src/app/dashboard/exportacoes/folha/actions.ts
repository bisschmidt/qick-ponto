'use server'

import { api, ApiError } from '@/lib/api'
import { requireSession } from '@/lib/session'

interface ValidacaoOk {
  ok: true
  data: { ok: boolean; pendencias: { tipo: string; descricao: string; refId?: string }[] }
}
interface ValidacaoErr { ok: false; error: string }

export async function validarFolhaAction(input: {
  sistema: string
  cnpj_estab_id: string
  competencia_ini: string
  competencia_fim: string
}): Promise<ValidacaoOk | ValidacaoErr> {
  const session = await requireSession()
  try {
    const data = await api.get<{ ok: boolean; pendencias: { tipo: string; descricao: string; refId?: string }[] }>(
      `/v1/exportacao-folha/validar?sistema=${input.sistema}&cnpj_estab_id=${input.cnpj_estab_id}&competencia_ini=${input.competencia_ini}&competencia_fim=${input.competencia_fim}`,
      session.token,
    )
    return { ok: true, data }
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, error: err.message }
    return { ok: false, error: 'Erro ao validar' }
  }
}
