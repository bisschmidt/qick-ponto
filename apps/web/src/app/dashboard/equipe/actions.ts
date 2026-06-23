'use server'

import { api, ApiError } from '@/lib/api'
import { requireSession } from '@/lib/session'

type Result = { ok: true } | { ok: false; error: string }

export async function aprovarComoGestorAction(ajusteId: string, encaminharRh: boolean): Promise<Result> {
  const session = await requireSession()
  try {
    await api.post(`/v1/ajustes/${ajusteId}/aprovar-gestor`, { obs: null, encaminhar_rh: encaminharRh }, session.token)
    return { ok: true }
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, error: err.message }
    return { ok: false, error: 'Erro ao aprovar' }
  }
}

export async function reprovarComoGestorAction(ajusteId: string, obs: string): Promise<Result> {
  const session = await requireSession()
  try {
    await api.post(`/v1/ajustes/${ajusteId}/reprovar-gestor`, { obs }, session.token)
    return { ok: true }
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, error: err.message }
    return { ok: false, error: 'Erro ao reprovar' }
  }
}

export async function aprovarComoRhAction(ajusteId: string): Promise<Result> {
  const session = await requireSession()
  try {
    await api.post(`/v1/ajustes/${ajusteId}/aprovar-rh`, { obs: null }, session.token)
    return { ok: true }
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, error: err.message }
    return { ok: false, error: 'Erro ao aprovar' }
  }
}

export async function pedirComprovacaoAction(ajusteId: string, obs: string): Promise<Result> {
  const session = await requireSession()
  try {
    await api.post(`/v1/ajustes/${ajusteId}/pedir-comprovacao`, { obs }, session.token)
    return { ok: true }
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, error: err.message }
    return { ok: false, error: 'Erro' }
  }
}
