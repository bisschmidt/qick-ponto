'use server'

import { api, ApiError } from '@/lib/api'
import { requireSession } from '@/lib/session'

type Result = { ok: true } | { ok: false; error: string }

const API_URL = process.env['API_URL'] ?? 'http://localhost:3000'

// Mapeamento de tipo amigável → motivo no banco (cria motivos genéricos se não existir)
const MOTIVOS_PADRAO: Record<string, string> = {
  ESQUECIMENTO:     'Esquecimento de marcação',
  CORRIGIR_HORARIO: 'Problema técnico no ponto',
  PROBLEMA_TECNICO: 'Problema técnico no ponto',
  JUSTIFICAR_FALTA: 'Falta abonada',
  ATESTADO:         'Atestado médico',
}

async function obterMotivoId(token: string, descricao: string): Promise<string> {
  const motivos = await api.get<{ id: string; descricao: string }[]>('/v1/motivos-ajuste', token)
  const m = motivos.find((x) => x.descricao === descricao)
  if (m) return m.id
  // Cria se não existir
  const novo = await api.post<{ id: string }>(
    '/v1/motivos-ajuste',
    { descricao, flag_desconto_va: false, flag_desconto_vt: false },
    token,
  )
  return novo.id
}

export async function solicitarAjusteAction(input: {
  colaborador_id: string
  data_ponto: string
  tipo_ajuste: string
  novo_timestamp?: string
  novo_tipo?: string
  marcacao_nsr?: string
  justificativa: string
}): Promise<Result> {
  const session = await requireSession()
  try {
    const descricaoMotivo = MOTIVOS_PADRAO[input.tipo_ajuste] ?? 'Esquecimento de marcação'
    const motivoId = await obterMotivoId(session.token, descricaoMotivo)
    const body: Record<string, unknown> = {
      colaborador_id: input.colaborador_id,
      motivo_id: motivoId,
      data_ponto: input.data_ponto,
      tipo_ajuste: input.tipo_ajuste,
      justificativa: input.justificativa,
    }
    if (input.novo_timestamp) body.novo_timestamp = input.novo_timestamp
    if (input.novo_tipo) body.novo_tipo = input.novo_tipo
    if (input.marcacao_nsr) body.marcacao_nsr = input.marcacao_nsr
    await api.post('/v1/ajustes', body, session.token)
    return { ok: true }
  } catch (err) {
    if (err instanceof ApiError) {
      // Trata erro de validação Zod (array de erros)
      try {
        const parsed = JSON.parse(err.message)
        if (Array.isArray(parsed) && parsed[0]?.message) {
          return { ok: false, error: parsed[0].message }
        }
      } catch { /* não é JSON */ }
      return { ok: false, error: err.message }
    }
    return { ok: false, error: 'Erro ao enviar ajuste' }
  }
}

export async function enviarAtestadoAction(formData: FormData): Promise<Result> {
  const session = await requireSession()
  try {
    // Repassa o multipart pra API
    const res = await fetch(`${API_URL}/v1/ajustes/atestado`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.token}` },
      body: formData,
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({ message: res.statusText }))
      return { ok: false, error: (data as { message?: string }).message ?? 'Erro ao enviar atestado' }
    }
    return { ok: true }
  } catch {
    return { ok: false, error: 'Erro ao enviar atestado' }
  }
}
