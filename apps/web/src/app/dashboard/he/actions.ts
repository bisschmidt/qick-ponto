'use server'

import { api, ApiError } from '@/lib/api'
import { requireSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'

type Result = { ok: true } | { ok: false; error: string }

function ok(): Result { return { ok: true } }
function fail(err: unknown, fallback: string): Result {
  if (err instanceof ApiError) return { ok: false, error: err.message }
  return { ok: false, error: fallback }
}

export async function lancarHeAction(input: {
  colaborador_id: string
  data: string
  hora_inicio: string
  hora_fim: string
  tipo: 'REMUNERADA' | 'COMPENSACAO'
  motivo?: string
}): Promise<Result> {
  const session = await requireSession()
  try {
    await api.post('/v1/he/planejada', input, session.token)
    revalidatePath('/dashboard/he')
    return ok()
  } catch (err) {
    return fail(err, 'Erro ao lançar HE')
  }
}

export async function ajustarHeAction(
  id: string,
  input: { data?: string; hora_inicio: string; hora_fim: string },
): Promise<Result> {
  const session = await requireSession()
  try {
    await api.post(`/v1/he/${id}/ajustar`, input, session.token)
    revalidatePath('/dashboard/he')
    return ok()
  } catch (err) {
    return fail(err, 'Erro ao ajustar HE')
  }
}

export async function cancelarHeAction(id: string): Promise<Result> {
  const session = await requireSession()
  try {
    await api.post(`/v1/he/${id}/cancelar`, {}, session.token)
    revalidatePath('/dashboard/he')
    return ok()
  } catch (err) {
    return fail(err, 'Erro ao cancelar HE')
  }
}

export async function aprovarCompensacaoAction(id: string): Promise<Result> {
  const session = await requireSession()
  try {
    await api.post(`/v1/he/compensacoes/${id}/aprovar`, {}, session.token)
    revalidatePath('/dashboard/he')
    return ok()
  } catch (err) {
    return fail(err, 'Erro ao aprovar')
  }
}

export async function reprovarCompensacaoAction(id: string, obs: string): Promise<Result> {
  const session = await requireSession()
  try {
    await api.post(`/v1/he/compensacoes/${id}/reprovar`, { obs }, session.token)
    revalidatePath('/dashboard/he')
    return ok()
  } catch (err) {
    return fail(err, 'Erro ao reprovar')
  }
}

export async function alterarCompensacaoAction(
  id: string,
  dias: { data: string; hora_inicio: string; hora_fim: string }[],
): Promise<Result> {
  const session = await requireSession()
  try {
    await api.post(`/v1/he/compensacoes/${id}/alterar`, { dias }, session.token)
    revalidatePath('/dashboard/he')
    return ok()
  } catch (err) {
    return fail(err, 'Erro ao alterar')
  }
}
