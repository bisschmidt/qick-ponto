'use server'

import { api, ApiError } from '@/lib/api'
import { requireSession } from '@/lib/session'

interface DiaHorario { dia_semana: number; hora_inicio: string; hora_fim: string }
interface NovaJornadaBody {
  nome: string
  tipo: string
  hora_inicio: string
  hora_fim: string
  dias_semana: number[]
  valida_feriado: boolean
  tolerancia_atraso_entrada: number
  tolerancia_atraso_intervalo: number
  tolerancia_antec_saida: number
  tolerancia_antec_inicio_interv: number
  janela_marcacao_min: number
  horarios: DiaHorario[]
}

function pausasPorTipo(tipo: string) {
  // Call center (NR-17): 2× pausa de 10 min + intervalo de 20 min (turno ≤ 6h)
  if (tipo === 'CALL_CENTER_NR17') {
    return [
      { nome: 'Pausa NR-17 (1ª)', ordem: 1, duracao_min: 10, eh_nr17: true, eh_intervalo_refeicao: false, computa_jornada: false },
      { nome: 'Intervalo para refeição', ordem: 2, duracao_min: 20, eh_nr17: true, eh_intervalo_refeicao: true, computa_jornada: false },
      { nome: 'Pausa NR-17 (2ª)', ordem: 3, duracao_min: 10, eh_nr17: true, eh_intervalo_refeicao: false, computa_jornada: false },
    ]
  }
  // Call center compensado (7h12): 2× pausa NR-17 de 10 min + intervalo de 60 min (turno > 6h → CLT art. 71)
  if (tipo === 'CALL_CENTER_COMP') {
    return [
      { nome: 'Pausa NR-17 (1ª)', ordem: 1, duracao_min: 10, eh_nr17: true, eh_intervalo_refeicao: false, computa_jornada: false },
      { nome: 'Intervalo para refeição', ordem: 2, duracao_min: 60, eh_nr17: true, eh_intervalo_refeicao: true, computa_jornada: false },
      { nome: 'Pausa NR-17 (2ª)', ordem: 3, duracao_min: 10, eh_nr17: true, eh_intervalo_refeicao: false, computa_jornada: false },
    ]
  }
  // Padrão CLT (8h) e escalas 12/36, 24/48: sem NR-17, intervalo de 60 min obrigatório (CLT art. 71)
  return [
    { nome: 'Intervalo para refeição', ordem: 1, duracao_min: 60, eh_nr17: false, eh_intervalo_refeicao: true, computa_jornada: false },
  ]
}

export async function criarJornadaAction(
  input: NovaJornadaBody,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireSession()

  const body = {
    ...input,
    pausas: pausasPorTipo(input.tipo),
  }

  try {
    await api.post('/v1/jornadas', body, session.token)
    return { ok: true }
  } catch (err) {
    if (err instanceof ApiError) return { ok: false, error: err.message }
    return { ok: false, error: 'Erro ao criar jornada' }
  }
}
