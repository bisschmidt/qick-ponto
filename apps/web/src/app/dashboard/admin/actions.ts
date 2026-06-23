'use server'

import { api, ApiError } from '@/lib/api'
import { requireSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'

type State = { ok: true } | { ok: false; error: string } | undefined

export async function salvarIpsAction(_prev: State, formData: FormData): Promise<State> {
  const session = await requireSession()
  const raw = (formData.get('ips') as string) ?? ''
  const ips = raw.split('\n').map((s) => s.trim()).filter(Boolean)
  try {
    await api.put('/v1/tenant/ips', { ips }, session.token)
    revalidatePath('/dashboard/admin')
    return { ok: true }
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, error: err.message }
    return { ok: false, error: 'Erro ao salvar IPs' }
  }
}

export async function salvarConfigHeAction(_prev: State, formData: FormData): Promise<State> {
  const session = await requireSession()
  const horasParaMin = (v: FormDataEntryValue | null) => Math.round(parseFloat((v as string) || '0') * 60)
  const intMin = parseInt((formData.get('intervalo_min') as string) || '0', 10)
  const body = {
    max_min_dia: horasParaMin(formData.get('max_dia_h')),
    max_min_semana: horasParaMin(formData.get('max_semana_h')),
    max_min_mes: horasParaMin(formData.get('max_mes_h')),
    intervalo_min_apos_jornada_min: Number.isFinite(intMin) ? intMin : 0,
  }
  if (body.max_min_dia <= 0 || body.max_min_semana <= 0 || body.max_min_mes <= 0) {
    return { ok: false, error: 'Os limites devem ser maiores que zero' }
  }
  try {
    await api.put('/v1/he/config', body, session.token)
    revalidatePath('/dashboard/admin')
    return { ok: true }
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, error: err.message }
    return { ok: false, error: 'Erro ao salvar configuração de HE' }
  }
}
