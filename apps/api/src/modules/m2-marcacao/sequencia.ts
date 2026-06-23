import type { TipoMarcacao, PausaConfig } from '@prisma/client'

// Deduz o próximo TipoMarcacao esperado baseado nas marcações já registradas no dia.
// O colaborador nunca informa o tipo — o sistema deduz pela posição na sequência (M2.7).
export function deduzirProximoTipo(
  marcacoesHoje: { tipo: TipoMarcacao }[],
  pausasConfig: PausaConfig[],
): TipoMarcacao {
  const tipos = marcacoesHoje.map((m) => m.tipo)
  const ultimo = tipos.at(-1)

  // Nenhuma marcação hoje → primeira é sempre ENTRADA
  if (!ultimo) return 'ENTRADA'

  // Após ENTRADA → primeira pausa/intervalo na sequência configurada
  if (ultimo === 'ENTRADA') {
    return proximaPausaNaSequencia(pausasConfig, 0)
  }

  // Após saída de pausa → retorno correspondente
  if (ultimo === 'SAIDA_PAUSA_NR17') return 'RETORNO_PAUSA_NR17'
  if (ultimo === 'SAIDA_INTERVALO') return 'RETORNO_INTERVALO'
  if (ultimo === 'SAIDA_PAUSA_FISIOLOGICA') return 'RETORNO_PAUSA_FISIOLOGICA'
  if (ultimo === 'SAIDA_PAUSA_CRITICA') return 'RETORNO_PAUSA_CRITICA'

  // Após retorno → próxima pausa/intervalo na sequência ou SAIDA
  const pausasConcluidasCount = contarPausasConcluidas(tipos)
  const proximaPausa = proximaPausaNaSequencia(pausasConfig, pausasConcluidasCount)
  if (proximaPausa) return proximaPausa

  // Após HE
  if (ultimo === 'ENTRADA_HE') return 'SAIDA_HE'
  if (ultimo === 'ENTRADA_COMPENSACAO') return 'SAIDA_COMPENSACAO'

  // Nenhuma pausa restante → fim de jornada
  return 'SAIDA'
}

function contarPausasConcluidas(tipos: TipoMarcacao[]): number {
  return tipos.filter(
    (t) => t === 'RETORNO_PAUSA_NR17' || t === 'RETORNO_INTERVALO',
  ).length
}

function proximaPausaNaSequencia(
  pausasConfig: PausaConfig[],
  pausasJaFeitas: number,
): TipoMarcacao {
  const ordenadas = [...pausasConfig].sort((a, b) => a.ordem - b.ordem)
  const proxima = ordenadas[pausasJaFeitas]

  if (!proxima) return 'SAIDA'

  if (proxima.eh_nr17 && !proxima.eh_intervalo_refeicao) return 'SAIDA_PAUSA_NR17'
  if (proxima.eh_intervalo_refeicao) return 'SAIDA_INTERVALO'

  // Pausa genérica (call center: mapear como NR-17 ou intervalo conforme config)
  return 'SAIDA_INTERVALO'
}
