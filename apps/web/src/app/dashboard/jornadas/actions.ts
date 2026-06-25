'use server'

import { api, ApiError } from '@/lib/api'
import { requireSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'

type Result = { ok: true } | { ok: false; error: string }

export async function inativarJornadaAction(id: string, ativo: boolean): Promise<Result> {
  const session = await requireSession()
  try {
    await api.patch(`/v1/jornadas/${id}/ativo`, { ativo }, session.token)
    revalidatePath('/dashboard/jornadas')
    return { ok: true }
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, error: err.message }
    return { ok: false, error: 'Erro ao alterar status da jornada' }
  }
}

export async function excluirJornadaAction(id: string): Promise<Result> {
  const session = await requireSession()
  try {
    await api.del(`/v1/jornadas/${id}`, session.token)
    revalidatePath('/dashboard/jornadas')
    return { ok: true }
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, error: err.message }
    return { ok: false, error: 'Erro ao excluir jornada' }
  }
}
