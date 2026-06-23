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

interface JornadaDoDia {
  eh_dia_escala: boolean
  minutos: number
  hora_inicio: string | null
  hora_fim: string | null
  max_min_dia: number
}

export async function getJornadaDoDiaAction(
  data: string,
): Promise<{ ok: true; info: JornadaDoDia } | { ok: false; error: string }> {
  const session = await requireSession()
  try {
    const info = await api.get<JornadaDoDia>(`/v1/he/jornada-do-dia?data=${encodeURIComponent(data)}`, session.token)
    return { ok: true, info }
  } catch (err) {
    return fail(err, 'Erro ao buscar jornada do dia') as { ok: false; error: string }
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
