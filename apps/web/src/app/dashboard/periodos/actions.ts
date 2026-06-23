'use server'

import { api, ApiError } from '@/lib/api'
import { requireSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'

type CriarState = { ok: true } | { ok: false; error: string } | undefined

export async function criarPeriodoAction(_prev: CriarState, formData: FormData): Promise<CriarState> {
  const session = await requireSession()
  try {
    await api.post('/v1/periodo', {
      data_inicio: formData.get('data_inicio') as string,
      data_fim:    formData.get('data_fim') as string,
    }, session.token)
    revalidatePath('/dashboard/periodos')
    return { ok: true }
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, error: err.message }
    return { ok: false, error: 'Erro ao criar período' }
  }
}

export async function fecharPeriodoAction(periodoId: string, cnpjEstabId: string) {
  const session = await requireSession()
  try {
    await api.post(`/v1/periodo/${periodoId}/fechar`, { cnpj_estab_id: cnpjEstabId }, session.token)
    revalidatePath('/dashboard/periodos')
    return { ok: true }
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, error: err.message }
    return { ok: false, error: 'Erro ao fechar período' }
  }
}
