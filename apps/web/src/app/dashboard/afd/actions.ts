'use server'

import { api, ApiError } from '@/lib/api'
import { requireSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'

export async function gerarAfdAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const session = await requireSession()
  try {
    await api.post('/v1/afd/gerar', {
      cnpj_estab_id: formData.get('cnpj_estab_id') as string,
      data_inicio:   formData.get('data_inicio') as string,
      data_fim:      formData.get('data_fim') as string,
      tipo:          formData.get('tipo') as string,
    }, session.token)
    revalidatePath('/dashboard/afd')
    return { ok: true }
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, error: err.message }
    return { ok: false, error: 'Erro ao gerar arquivo' }
  }
}
