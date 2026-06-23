'use server'

import { api, ApiError } from '@/lib/api'
import { requireSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'

type Result = { ok: true } | { ok: false; error: string }

function fail(err: unknown, fallback: string): Result {
  if (err instanceof ApiError) return { ok: false, error: err.message }
  return { ok: false, error: fallback }
}

export async function aceitarHeAction(id: string): Promise<Result> {
  const session = await requireSession()
  try {
    await api.post(`/v1/he/${id}/aceitar`, {}, session.token)
    revalidatePath('/ponto/compensacao')
    return { ok: true }
  } catch (err) {
    return fail(err, 'Erro ao aceitar HE')
  }
}

export async function recusarHeAction(id: string): Promise<Result> {
  const session = await requireSession()
  try {
    await api.post(`/v1/he/${id}/recusar`, {}, session.token)
    revalidatePath('/ponto/compensacao')
    return { ok: true }
  } catch (err) {
    return fail(err, 'Erro ao recusar HE')
  }
}

export async function solicitarCompensacaoAction(input: {
  data_falta: string
  motivo: string
  dias: { data: string; hora_inicio: string; hora_fim: string }[]
}): Promise<Result> {
  const session = await requireSession()
  try {
    await api.post('/v1/he/compensacao', input, session.token)
    revalidatePath('/ponto/compensacao')
    return { ok: true }
  } catch (err) {
    return fail(err, 'Erro ao solicitar compensação')
  }
}
