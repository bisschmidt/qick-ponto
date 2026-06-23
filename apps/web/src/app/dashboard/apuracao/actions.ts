'use server'

import { api, ApiError } from '@/lib/api'
import { requireSession } from '@/lib/session'
import { revalidatePath } from 'next/cache'

export interface ApuracaoResult {
  diasApurados: number
  minutosTrabalhados: number
  minutosHe50: number
  minutosHe100: number
  minutosAtraso: number
  faltas: number
  inconsistencias: { data: string; descricao: string }[]
}

export type ApuracaoState =
  | { ok: true; resultado: ApuracaoResult }
  | { ok: false; error: string }
  | undefined

export interface ApuracaoLoteResult {
  periodo: { inicio: string; fim: string }
  total_colaboradores: number
  apurados: number
  falhas: number
  resultados: { colaborador_id: string; nome: string; matricula: string; dias_apurados: number; inconsistencias: number }[]
  erros: { colaborador_id: string; nome: string; matricula: string; erro: string }[]
}

export type ApuracaoLoteState =
  | { ok: true; resultado: ApuracaoLoteResult }
  | { ok: false; error: string }
  | undefined

export async function rodarApuracaoLoteAction(_prev: ApuracaoLoteState, formData: FormData): Promise<ApuracaoLoteState> {
  const session = await requireSession()
  try {
    const resultado = await api.post<ApuracaoLoteResult>('/v1/apuracao/lote', {
      data_inicio: formData.get('data_inicio') as string,
      data_fim:    formData.get('data_fim') as string,
    }, session.token)
    revalidatePath('/dashboard/apuracao')
    return { ok: true, resultado }
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, error: err.message }
    return { ok: false, error: 'Erro ao rodar apuração em lote' }
  }
}

export async function rodarApuracaoAction(_prev: ApuracaoState, formData: FormData): Promise<ApuracaoState> {
  const session = await requireSession()

  const colaborador_id = formData.get('colaborador_id') as string
  if (!colaborador_id) return { ok: false, error: 'Selecione um colaborador' }

  try {
    const resultado = await api.post<ApuracaoResult>('/v1/apuracao', {
      colaborador_id,
      data_inicio: formData.get('data_inicio') as string,
      data_fim:    formData.get('data_fim') as string,
    }, session.token)
    revalidatePath('/dashboard/apuracao')
    return { ok: true, resultado }
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, error: err.message }
    return { ok: false, error: 'Erro ao rodar apuração' }
  }
}
