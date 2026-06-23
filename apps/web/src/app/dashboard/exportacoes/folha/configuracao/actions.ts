'use server'

import { api, ApiError } from '@/lib/api'
import { requireSession } from '@/lib/session'

type Result = { ok: true } | { ok: false; error: string }

export async function salvarConfigAction(input: { sistema: string; codigo_empresa: string }): Promise<Result> {
  const session = await requireSession()
  try {
    await api.post('/v1/exportacao-folha/config', input, session.token)
    return { ok: true }
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, error: err.message }
    return { ok: false, error: 'Erro ao salvar configuração' }
  }
}

export async function salvarMapeamentoAction(input: {
  sistema: string
  evento: string
  codigo_externo: string
}): Promise<Result> {
  const session = await requireSession()
  try {
    await api.post('/v1/exportacao-folha/mapeamento', input, session.token)
    return { ok: true }
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, error: err.message }
    return { ok: false, error: 'Erro ao salvar mapeamento' }
  }
}

export async function salvarCodigoColaboradorAction(input: {
  colaborador_id: string
  sistema: string
  codigo: string
}): Promise<Result> {
  const session = await requireSession()
  try {
    await api.post('/v1/exportacao-folha/codigo-colaborador', input, session.token)
    return { ok: true }
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, error: err.message }
    return { ok: false, error: 'Erro ao salvar código' }
  }
}
