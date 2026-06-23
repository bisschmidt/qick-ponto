'use server'

import { api, ApiError } from '@/lib/api'
import { requireSession } from '@/lib/session'
import { headers } from 'next/headers'

interface ProximoEventoResponse {
  proximoTipo: string
  label: string
  marcacoesHoje: Array<{ tipo: string; timestamp_marcacao: string }>
}

interface MarcacaoResponse {
  nsr: string
  tipo: string
  label: string
  timestamp_marcacao: string
  alerta: string | null
}

export async function getProximoEvento(): Promise<ProximoEventoResponse> {
  const session = await requireSession()
  return api.get<ProximoEventoResponse>('/v1/marcacoes/proximo-evento', session.token)
}

interface MinhaHe {
  id: string
  data: string
  hora_inicio: string
  hora_fim: string
  tipo: string
  status: string
}

export async function getMinhasHeHoje(): Promise<MinhaHe[]> {
  const session = await requireSession()
  const hojeBRT = new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10)
  try {
    const r = await api.get<{ hes: MinhaHe[] }>('/v1/he/minhas', session.token)
    return r.hes.filter((h) => h.status === 'AGUARDANDO_MARCACAO' && h.data.slice(0, 10) === hojeBRT)
  } catch {
    return []
  }
}

export async function baterHeAction(): Promise<{ ok: true; tipo: string; concluida: boolean } | { ok: false; error: string }> {
  const session = await requireSession()
  try {
    const res = await api.post<{ tipo: string; concluida: boolean }>('/v1/he/bater', { canal: 'WEB' }, session.token)
    return { ok: true, tipo: res.tipo, concluida: res.concluida }
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, error: err.message }
    return { ok: false, error: 'Erro ao bater hora extra' }
  }
}

export async function baterPonto(): Promise<{ ok: true; tipo: string; hora: string; alerta?: string } | { ok: false; error: string }> {
  const session = await requireSession()

  // Captura o IP real do cliente via header X-Forwarded-For
  const headerStore = await headers()
  const clientIp =
    headerStore.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    headerStore.get('x-real-ip') ??
    '127.0.0.1'

  try {
    const res = await api.post<MarcacaoResponse>(
      '/v1/marcacoes',
      { ip: clientIp, canal: 'WEB' },
      session.token,
    )
    return {
      ok: true,
      tipo: res.tipo,
      hora: new Date(res.timestamp_marcacao).toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/Sao_Paulo',
      }),
      ...(res.alerta ? { alerta: res.alerta } : {}),
    }
  } catch (err) {
    if (err instanceof ApiError) {
      return { ok: false, error: err.message }
    }
    return { ok: false, error: 'Erro ao registrar ponto' }
  }
}
