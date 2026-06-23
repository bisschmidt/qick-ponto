'use server'

import { api, ApiError } from '@/lib/api'
import { requireSession } from '@/lib/session'

type Result = { ok: true } | { ok: false; error: string }

export async function criarFeriadoAction(input: {
  nome: string
  tipo: string
  uf?: string | null
  municipio?: string | null
  data_inicio: string
  data_fim?: string
}): Promise<Result> {
  const session = await requireSession()
  try {
    await api.post('/v1/feriados', input, session.token)
    return { ok: true }
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, error: err.message }
    return { ok: false, error: 'Erro ao criar feriado' }
  }
}

export async function removerFeriadoAction(id: string): Promise<Result> {
  const session = await requireSession()
  try {
    await api.del(`/v1/feriados/${id}`, session.token)
    return { ok: true }
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, error: err.message }
    return { ok: false, error: 'Erro ao remover' }
  }
}
