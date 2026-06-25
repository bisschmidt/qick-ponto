import type { CriarJornadaInput } from './schema.js'

type PausaInput = CriarJornadaInput['pausas'][number]

const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

// Validação hard das pausas NR-17 para UMA janela de horário (M1.3.4 + M3).
// A quantidade de pausas e a janela proibida são recalculadas conforme a duração
// daquele horário — por isso vale tanto para o horário base quanto por dia da semana.
// Nenhuma exceção — nunca chamada com override.
export function validarHorarioNR17(
  horaInicio: string,
  horaFim: string,
  pausas: PausaInput[],
  contexto?: string,
): string | null {
  const sufixo = contexto ? ` (${contexto})` : ''
  const [hInicio, mInicio] = horaInicio.split(':').map(Number)
  const [hFim, mFim] = horaFim.split(':').map(Number)

  if (hInicio === undefined || mInicio === undefined || hFim === undefined || mFim === undefined) {
    return `Horário de início/fim inválido${sufixo}`
  }

  const totalMinutos = (hFim * 60 + mFim) - (hInicio * 60 + mInicio)
  if (totalMinutos <= 0) {
    return `Horário de fim deve ser posterior ao de início${sufixo}`
  }

  const pausasNR17 = pausas.filter((p) => p.eh_nr17 && !p.eh_intervalo_refeicao)
  const pausasEsperadas = totalMinutos > 240 ? 2 : 1 // acima de 4h = 2 pausas

  if (pausasNR17.length < pausasEsperadas) {
    return `Jornada NR-17 acima de ${totalMinutos > 240 ? '4h' : '0'} exige ${pausasEsperadas} pausa(s) de descanso de 10 minutos${sufixo}`
  }

  for (const pausa of pausasNR17) {
    if (pausa.duracao_min < 10) {
      return `Pausa NR-17 "${pausa.nome}" deve ter duração mínima de 10 minutos contínuos${sufixo}`
    }

    // Janela: nunca nos primeiros nem nos últimos 60 min
    if (pausa.janela_inicio_min !== undefined && pausa.janela_inicio_min < 60) {
      return `Pausa NR-17 "${pausa.nome}" não pode ser nos primeiros 60 minutos da jornada${sufixo}`
    }

    if (pausa.janela_fim_min !== undefined && pausa.janela_fim_min < 60) {
      return `Pausa NR-17 "${pausa.nome}" não pode ser nos últimos 60 minutos da jornada${sufixo}`
    }
  }

  // Intervalo de refeição NR-17: mínimo 20 min
  const intervalo = pausas.find((p) => p.eh_intervalo_refeicao)
  if (intervalo && intervalo.duracao_min < 20) {
    return `Intervalo de refeição NR-17 deve ter duração mínima de 20 minutos${sufixo}`
  }

  return null
}

// Valida o horário base e cada horário por dia da semana (quando informado).
export function validarJornadaNR17(input: CriarJornadaInput): string | null {
  const erroBase = validarHorarioNR17(input.hora_inicio, input.hora_fim, input.pausas)
  if (erroBase) return erroBase

  for (const h of input.horarios ?? []) {
    const erro = validarHorarioNR17(h.hora_inicio, h.hora_fim, input.pausas, DIAS[h.dia_semana] ?? `dia ${h.dia_semana}`)
    if (erro) return erro
  }

  return null
}
