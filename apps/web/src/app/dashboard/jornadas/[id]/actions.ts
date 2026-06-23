'use server'

import { api, ApiError } from '@/lib/api'
import { requireSession } from '@/lib/session'

export async function atualizarJornadaAction(
  id: string,
  body: Record<string, unknown>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSession()
  try {
    await api.put(`/v1/jornadas/${id}`, body, session.token)
    return { ok: true }
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, error: err.message }
    return { ok: false, error: 'Erro ao atualizar' }
  }
}
