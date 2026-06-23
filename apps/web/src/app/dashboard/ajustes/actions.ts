'use server'

import { api, ApiError } from '@/lib/api'
import { requireSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'

export async function justificarFaltaAction(input: {
  colaborador_id: string
  motivo_id: string
  data_ponto: string
  justificativa: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSession()
  try {
    await api.post('/v1/ajustes/justificar-falta', input, session.token)
    revalidatePath('/dashboard/ajustes')
    revalidatePath('/ponto/ficha', 'layout')
    return { ok: true }
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, error: err.message }
    return { ok: false, error: 'Erro ao justificar falta' }
  }
}

export async function aprovarGestorAction(ajusteId: string, encaminharRh: boolean) {
  const session = await requireSession()
  try {
    await api.post(`/v1/ajustes/${ajusteId}/aprovar-gestor`, { obs: null, encaminhar_rh: encaminharRh }, session.token)
    revalidatePath('/dashboard/ajustes')
    revalidatePath('/ponto/ficha', 'layout')
    return { ok: true }
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, error: err.message }
    return { ok: false, error: 'Erro ao aprovar' }
  }
}

export async function reprovarGestorAction(ajusteId: string) {
  const session = await requireSession()
  try {
    await api.post(`/v1/ajustes/${ajusteId}/reprovar-gestor`, { obs: null }, session.token)
    revalidatePath('/dashboard/ajustes')
    revalidatePath('/ponto/ficha', 'layout')
    return { ok: true }
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, error: err.message }
    return { ok: false, error: 'Erro ao reprovar' }
  }
}

export async function aprovarRhAction(ajusteId: string) {
  const session = await requireSession()
  try {
    await api.post(`/v1/ajustes/${ajusteId}/aprovar-rh`, { obs: null }, session.token)
    revalidatePath('/dashboard/ajustes')
    revalidatePath('/ponto/ficha', 'layout')
    return { ok: true }
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, error: err.message }
    return { ok: false, error: 'Erro ao aprovar' }
  }
}

export async function reprovarRhAction(ajusteId: string) {
  const session = await requireSession()
  try {
    await api.post(`/v1/ajustes/${ajusteId}/reprovar-rh`, { obs: null }, session.token)
    revalidatePath('/dashboard/ajustes')
    revalidatePath('/ponto/ficha', 'layout')
    return { ok: true }
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, error: err.message }
    return { ok: false, error: 'Erro ao reprovar' }
  }
}
