'use server'

import { api, ApiError } from '@/lib/api'
import { requireSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'

type Result = { ok: true } | { ok: false; error: string }

export async function aprovarAjusteAction(ajusteId: string): Promise<Result> {
  const session = await requireSession()
  try {
    await api.post(`/v1/ajustes/${ajusteId}/aprovar-gestor`, { encaminhar_rh: true, obs: null }, session.token)
    revalidatePath('/ponto/ficha', 'layout')
    revalidatePath('/dashboard/ajustes')
    return { ok: true }
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, error: err.message }
    return { ok: false, error: 'Erro ao aprovar' }
  }
}

export async function reprovarAjusteAction(ajusteId: string, obs: string): Promise<Result> {
  const session = await requireSession()
  try {
    await api.post(`/v1/ajustes/${ajusteId}/reprovar-gestor`, { obs }, session.token)
    revalidatePath('/ponto/ficha', 'layout')
    revalidatePath('/dashboard/ajustes')
    return { ok: true }
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, error: err.message }
    return { ok: false, error: 'Erro ao reprovar' }
  }
}

export async function pedirComprovacaoAction(ajusteId: string, obs: string): Promise<Result> {
  const session = await requireSession()
  try {
    await api.post(`/v1/ajustes/${ajusteId}/aprovar-gestor`, { encaminhar_rh: false, obs }, session.token)
    revalidatePath('/ponto/ficha', 'layout')
    revalidatePath('/dashboard/ajustes')
    return { ok: true }
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, error: err.message }
    return { ok: false, error: 'Erro ao enviar observação' }
  }
}

export async function marcarSaidaAntecipadaAction(
  colaboradorId: string,
  dataPonto: string,
  justificativa: string,
): Promise<Result> {
  const session = await requireSession()
  try {
    await api.post('/v1/gestor/marcar-saida-antecipada', { colaborador_id: colaboradorId, data_ponto: dataPonto, justificativa }, session.token)
    revalidatePath('/ponto/ficha', 'layout')
    revalidatePath('/dashboard/ajustes')
    return { ok: true }
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, error: err.message }
    return { ok: false, error: 'Erro ao marcar saída antecipada' }
  }
}

export async function criarAjusteSubordinadoAction(input: {
  colaborador_id: string
  motivo_id: string
  data_ponto: string
  tipo_ajuste: string
  justificativa: string
  novo_timestamp?: string
  novo_tipo?: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSession()
  try {
    const body: Record<string, unknown> = {
      colaborador_id: input.colaborador_id,
      motivo_id: input.motivo_id,
      data_ponto: input.data_ponto,
      tipo_ajuste: input.tipo_ajuste,
      justificativa: input.justificativa,
    }
    if (input.novo_timestamp) body.novo_timestamp = input.novo_timestamp
    if (input.novo_tipo) body.novo_tipo = input.novo_tipo
    await api.post('/v1/gestor/criar-ajuste', body, session.token)
    return { ok: true }
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, error: err.message }
    return { ok: false, error: 'Erro ao criar ajuste' }
  }
}
