'use server'

import { api, ApiError } from '@/lib/api'
import { requireSession } from '@/lib/session'

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

// Salva os campos de Detalhes (pessoais + profissionais) sem sair da aba.
// CPF, PIS, matrícula e CNPJ de lotação NÃO entram aqui — são imutáveis pela ficha
// (impacto direto em AFD/AEJ); alteração desses exige fluxo de correção dedicado.
export async function salvarPerfilAction(input: {
  id: string
  nome_completo?: string
  nome_social?: string
  usar_nome_social?: boolean
  email_corporativo?: string
  whatsapp?: string
  centro_custo?: string
  operacao_cliente?: string
  cargo?: string
  time_nome?: string
  departamento?: string
  nova_jornada_id?: string
}): Promise<State> {
  const session = await requireSession()
  const { id, ...rest } = input
  const payload = Object.fromEntries(
    Object.entries(rest).filter(([, v]) => v !== undefined && v !== ''),
  )
  try {
    await api.patch(`/v1/colaboradores/${id}`, payload, session.token)
    return { ok: true }
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, error: err.message }
    return { ok: false, error: 'Erro ao salvar' }
  }
}

// Salva canais de marcação + validação facial (aba Configurações).
export async function salvarConfigMarcacaoAction(
  id: string,
  config: {
    validacao_facial?: boolean
    canal_app?: boolean
    canal_quiosque?: boolean
    canal_computador?: boolean
  },
): Promise<State> {
  const session = await requireSession()
  try {
    await api.patch(`/v1/colaboradores/${id}/config-marcacao`, config, session.token)
    return { ok: true }
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, error: err.message }
    return { ok: false, error: 'Erro ao salvar configuração' }
  }
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
