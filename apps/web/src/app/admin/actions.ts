'use server'

import { api, ApiError } from '@/lib/api'

export async function saveIpsAction(
  ips: string[],
  token: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await api.put('/v1/tenant/ips', { ips_permitidos: ips }, token)
    return { ok: true }
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, error: err.message }
    return { ok: false, error: 'Erro ao salvar' }
  }
}
