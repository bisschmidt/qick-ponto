'use server'

import { api, ApiError } from '@/lib/api'
import { requireSession } from '@/lib/session'
import { redirect } from 'next/navigation'

type State = { ok: true } | { ok: false; error: string } | undefined

export async function desligarAction(colaboradorId: string, dataDesligamento: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSession()
  try {
    await api.post(`/v1/colaboradores/${colaboradorId}/desligar`, { data_desligamento: dataDesligamento }, session.token)
    return { ok: true }
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, error: err.message }
    return { ok: false, error: 'Erro ao desligar' }
  }
}

export async function reativarAction(colaboradorId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSession()
  try {
    await api.post(`/v1/colaboradores/${colaboradorId}/reativar`, {}, session.token)
    return { ok: true }
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, error: err.message }
    return { ok: false, error: 'Erro ao reativar' }
  }
}

export async function salvarCodigoFolhaAction(input: {
  colaborador_id: string
  sistema: string
  codigo: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSession()
  try {
    await api.post('/v1/exportacao-folha/codigo-colaborador', input, session.token)
    return { ok: true }
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, error: err.message }
    return { ok: false, error: 'Erro ao salvar código' }
  }
}

export async function editarColaboradorAction(_prev: State, formData: FormData): Promise<State> {
  const session = await requireSession()
  const id = formData.get('id') as string

  const nova_jornada_id = formData.get('nova_jornada_id') as string | null

  const body: Record<string, string | undefined> = {
    nome_completo:    (formData.get('nome_completo') as string) || undefined,
    email_corporativo:(formData.get('email_corporativo') as string) || undefined,
    whatsapp:         (formData.get('whatsapp') as string) || undefined,
    centro_custo:     (formData.get('centro_custo') as string) || undefined,
    operacao_cliente: (formData.get('operacao_cliente') as string) || undefined,
    ...(nova_jornada_id ? { nova_jornada_id } : {}),
  }

  // remove undefined values
  const payload = Object.fromEntries(
    Object.entries(body).filter(([, v]) => v !== undefined),
  )

  try {
    await api.patch(`/v1/colaboradores/${id}`, payload, session.token)
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, error: err.message }
    return { ok: false, error: 'Erro ao salvar' }
  }

  redirect('/dashboard/colaboradores')
}

export async function definirSenhaAction(_prev: State, formData: FormData): Promise<State> {
  const session = await requireSession()
  const id = formData.get('id') as string
  const senha = formData.get('senha') as string
  const confirmar = formData.get('confirmar') as string

  if (senha !== confirmar) return { ok: false, error: 'As senhas não conferem' }
  if (senha.length < 6) return { ok: false, error: 'Senha deve ter pelo menos 6 caracteres' }

  try {
    await api.post(`/v1/colaboradores/${id}/senha`, { senha }, session.token)
    return { ok: true }
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, error: err.message }
    return { ok: false, error: 'Erro ao definir senha' }
  }
}

export async function aceitarLgpdAction(colaboradorId: string): Promise<State> {
  const session = await requireSession()
  try {
    await api.post(`/v1/colaboradores/${colaboradorId}/aceite-lgpd`, {}, session.token)
    return { ok: true }
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, error: err.message }
    return { ok: false, error: 'Erro ao registrar aceite LGPD' }
  }
}

export async function reenviarConviteAction(colaboradorId: string): Promise<State> {
  const session = await requireSession()
  try {
    await api.post(`/v1/colaboradores/${colaboradorId}/reenviar-convite`, {}, session.token)
    return { ok: true }
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, error: err.message }
    return { ok: false, error: 'Erro ao reenviar convite' }
  }
}
