import type { CriarJornadaInput } from './schema.js'

// Validação hard das pausas NR-17 (M1.3.4 + M3).
// Nenhuma exceção — nunca chamada com override.
export function validarJornadaNR17(input: CriarJornadaInput): string | null {
  const [hInicio, mInicio] = input.hora_inicio.split(':').map(Number)
  const [hFim, mFim] = input.hora_fim.split(':').map(Number)

  if (hInicio === undefined || mInicio === undefined || hFim === undefined || mFim === undefined) {
    return 'Horário de início/fim inválido'
  }

  const totalMinutos = (hFim * 60 + mFim) - (hInicio * 60 + mInicio)
  if (totalMinutos <= 0) {
    return 'Horário de fim deve ser posterior ao de início'
  }

  const pausasNR17 = input.pausas.filter((p) => p.eh_nr17 && !p.eh_intervalo_refeicao)
  const pausasEsperadas = totalMinutos > 240 ? 2 : 1 // acima de 4h = 2 pausas

  if (pausasNR17.length < pausasEsperadas) {
    return `Jornada NR-17 acima de ${totalMinutos > 240 ? '4h' : '0'} exige ${pausasEsperadas} pausa(s) de descanso de 10 minutos`
  }

  for (const pausa of pausasNR17) {
    if (pausa.duracao_min < 10) {
      return `Pausa NR-17 "${pausa.nome}" deve ter duração mínima de 10 minutos contínuos`
    }

    // Janela: nunca nos primeiros nem nos últimos 60 min
    if (pausa.janela_inicio_min !== undefined && pausa.janela_inicio_min < 60) {
      return `Pausa NR-17 "${pausa.nome}" não pode ser nos primeiros 60 minutos da jornada`
    }

    if (pausa.janela_fim_min !== undefined && pausa.janela_fim_min < 60) {
      return `Pausa NR-17 "${pausa.nome}" não pode ser nos últimos 60 minutos da jornada`
    }
  }

  // Intervalo de refeição NR-17: mínimo 20 min
  const intervalo = input.pausas.find((p) => p.eh_intervalo_refeicao)
  if (intervalo && intervalo.duracao_min < 20) {
    return 'Intervalo de refeição NR-17 deve ter duração mínima de 20 minutos'
  }

  return null
}
