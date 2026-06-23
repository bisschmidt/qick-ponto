'use server'

import { api, ApiError } from '@/lib/api'
import { requireSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'

export async function assinarEspelhoAction(espelhoId: string) {
  const session = await requireSession()
  try {
    await api.post(`/v1/espelho/${espelhoId}/assinar`, {}, session.token)
    revalidatePath('/dashboard/periodos/detalhe')
    return { ok: true }
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, error: err.message }
    return { ok: false, error: 'Erro ao assinar' }
  }
}

export async function naoManifestadoAction(espelhoId: string) {
  const session = await requireSession()
  try {
    await api.post(`/v1/espelho/${espelhoId}/nao-manifestado`, {}, session.token)
    revalidatePath('/dashboard/periodos/detalhe')
    return { ok: true }
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, error: err.message }
    return { ok: false, error: 'Erro' }
  }
}
