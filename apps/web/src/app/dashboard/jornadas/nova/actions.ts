'use server'

import { api, ApiError } from '@/lib/api'
import { requireSession } from '@/lib/session'
import { redirect } from 'next/navigation'

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

export async function criarJornadaAction(_prev: { error?: string } | undefined, formData: FormData) {
  const session = await requireSession()

  const tipo = formData.get('tipo') as string
  const diasRaw = formData.getAll('dias_semana').map(Number)

  const body = {
    nome:             formData.get('nome') as string,
    tipo,
    hora_inicio:      formData.get('hora_inicio') as string,
    hora_fim:         formData.get('hora_fim') as string,
    dias_semana:      diasRaw,
    valida_feriado:   formData.get('valida_feriado') === 'on',
    tolerancia_atraso_entrada:       Number(formData.get('tol_entrada') ?? 5),
    tolerancia_atraso_intervalo:     Number(formData.get('tol_intervalo') ?? 5),
    tolerancia_antec_saida:          Number(formData.get('tol_saida') ?? 5),
    tolerancia_antec_inicio_interv:  Number(formData.get('tol_inicio_interv') ?? 5),
    janela_marcacao_min:             Number(formData.get('janela_marcacao') ?? 15),
    pausas: pausasPorTipo(tipo),
  }

  try {
    await api.post('/v1/jornadas', body, session.token)
  } catch (err) {
    if (err instanceof ApiError) return { error: err.message }
    return { error: 'Erro ao criar jornada' }
  }

  redirect('/dashboard/jornadas')
}
