// M3 — Conformidade NR-17 Anexo II (call center)
// Regras principais:
//   • Jornada ≤ 4h: sem pausa obrigatória
//   • 4h < jornada ≤ 6h: 1 pausa NR-17 de 10 min (computada)
//   • Jornada > 6h: mínimo 2 pausas NR-17 de 10 min + intervalo de refeição ≥ 20 min
//   • Trabalho contínuo máx 50 min → pausa obrigatória de 10 min (art. 72 CLT + NR-17)
//   • Pausas fisiológicas: a qualquer momento, sem restrição, computadas
//   • Primeira e última hora: pausas NR-17 NÃO devem ocorrer neste período

import type { TipoMarcacao } from '@prisma/client'

export type StatusOperador =
  | 'TRABALHANDO'
  | 'EM_PAUSA_NR17'
  | 'EM_INTERVALO'
  | 'EM_PAUSA_FISIOLOGICA'
  | 'EM_PAUSA_CRITICA'
  | 'FORA_DA_JORNADA'

export interface PausaConfigNr17 {
  id: string
  ordem: number
  duracaoMinMin: number
  ehNr17: boolean
  ehIntervaloRefeicao: boolean
  computaNaJornada: boolean
  janelaInicioMin: number | null  // minutos após entrada — null = sem restrição
  janelaFimMin: number | null     // minutos antes do fim — null = sem restrição
}

export interface MarcacaoSimples {
  tipo: TipoMarcacao
  timestamp: Date
}

export interface ProximaPausa {
  tipo: 'NR17' | 'INTERVALO' | 'FISIOLOGICA'
  devePausarAteMs: number | null  // null = sem hora limite definida
  urgente: boolean                // true quando restam ≤ 5 min para o limite
}

export interface StatusPausaDia {
  pausaId: string
  ordem: number
  tomada: boolean
  duracaoRealMin: number | null
  dentroDaJanela: boolean
  conformeNr17: boolean
}

export interface ResultadoStatusNr17 {
  agora: Date
  statusAtual: StatusOperador

  // Tempo de trabalho contínuo sem pausa (desde a última pausa ou entrada)
  minutosTrabalhoContinuo: number

  // Limite de trabalho contínuo (50 min segundo art. 72 CLT)
  limiteTrabalhoContMinutos: number

  // Alerta de trabalho contínuo (não inclui no `conforme` — é aviso em tempo real)
  alertaContinuo: boolean

  // Próxima pausa obrigatória
  proximaPausa: ProximaPausa | null

  // Status de cada pausa NR-17 da jornada
  pausasDia: StatusPausaDia[]

  // Conformidade das pausas AGENDADAS (não inclui alertas de tempo real)
  // false apenas quando pausas obrigatórias não foram feitas corretamente
  conforme: boolean
  motivos: string[]
}

const LIMITE_TRABALHO_CONTINUO_MIN = 50

export function calcularStatusNr17(params: {
  agora: Date
  entrada: Date | null
  saida: Date | null
  duracaoJornadaMin: number
  pausasConfig: PausaConfigNr17[]
  marcacoesDia: MarcacaoSimples[]
}): ResultadoStatusNr17 {
  const { agora, entrada, saida, duracaoJornadaMin, pausasConfig, marcacoesDia } = params

  if (!entrada) {
    return semJornada(agora)
  }

  // ── 1. Status atual do operador ─────────────────────────────────────────────

  const statusAtual = inferirStatusAtual(marcacoesDia, agora)

  // ── 2. Tempo de trabalho contínuo ──────────────────────────────────────────

  const minutosTrabalhoContinuo = calcularTrabalhoContinuo(marcacoesDia, agora, entrada)

  // ── 3. Análise de cada pausa NR-17 configurada ─────────────────────────────

  const pausasNr17 = pausasConfig
    .filter((p) => p.ehNr17 && !p.ehIntervaloRefeicao)
    .sort((a, b) => a.ordem - b.ordem)

  const pausasDia = pausasNr17.map((config) => {
    const par = encontrarParDePausa(
      marcacoesDia,
      'SAIDA_PAUSA_NR17',
      'RETORNO_PAUSA_NR17',
      config.ordem,
    )
    const tomada = par !== null
    const duracaoRealMin = par
      ? Math.floor((par.retorno.getTime() - par.saida.getTime()) / 60000)
      : null

    const dentroDaJanela = tomada
      ? verificarJanela(par!.saida, entrada, saida, config, duracaoJornadaMin)
      : false

    const conformeNr17 =
      tomada &&
      (duracaoRealMin ?? 0) >= config.duracaoMinMin &&
      dentroDaJanela

    return {
      pausaId: config.id,
      ordem: config.ordem,
      tomada,
      duracaoRealMin,
      dentroDaJanela,
      conformeNr17,
    }
  })

  // ── 4. Intervalo de refeição ────────────────────────────────────────────────

  const configIntervalo = pausasConfig.find((p) => p.ehIntervaloRefeicao)
  let intervaloConforme = true

  if (configIntervalo && duracaoJornadaMin > 360) {
    const par = encontrarParDePausa(
      marcacoesDia,
      'SAIDA_INTERVALO',
      'RETORNO_INTERVALO',
      0, // intervalo não tem ordem específica entre as NR-17
    )
    if (!par) {
      // Ainda não tomado — não é não-conformidade se ainda houver tempo
      intervaloConforme = agora.getTime() < (saida?.getTime() ?? Infinity)
    } else {
      const durReal = Math.floor((par.retorno.getTime() - par.saida.getTime()) / 60000)
      intervaloConforme = durReal >= configIntervalo.duracaoMinMin
    }
  }

  // ── 5. Motivos de não-conformidade ─────────────────────────────────────────

  const motivos: string[] = []

  const pausasNaoConformes = pausasDia.filter((p) => !p.tomada || !p.conformeNr17)
  if (pausasNaoConformes.length > 0) {
    motivos.push(`${pausasNaoConformes.length} pausa(s) NR-17 não conforme(s)`)
  }
  if (!intervaloConforme) {
    motivos.push('Intervalo de refeição insuficiente ou não realizado')
  }

  // Alerta de trabalho contínuo: aviso em tempo real, não penaliza conformidade do dia
  const alertaContinuo = minutosTrabalhoContinuo > LIMITE_TRABALHO_CONTINUO_MIN

  const conforme = motivos.length === 0

  // ── 6. Próxima pausa obrigatória ───────────────────────────────────────────

  const proximaPausa = calcularProximaPausa(
    statusAtual,
    minutosTrabalhoContinuo,
    pausasDia,
    pausasNr17,
    agora,
  )

  return {
    agora,
    statusAtual,
    minutosTrabalhoContinuo,
    limiteTrabalhoContMinutos: LIMITE_TRABALHO_CONTINUO_MIN,
    alertaContinuo,
    proximaPausa,
    pausasDia,
    conforme,
    motivos,
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function semJornada(agora: Date): ResultadoStatusNr17 {
  return {
    agora,
    statusAtual: 'FORA_DA_JORNADA',
    minutosTrabalhoContinuo: 0,
    limiteTrabalhoContMinutos: LIMITE_TRABALHO_CONTINUO_MIN,
    alertaContinuo: false,
    proximaPausa: null,
    pausasDia: [],
    conforme: true,
    motivos: [],
  }
}

function inferirStatusAtual(marcacoes: MarcacaoSimples[], agora: Date): StatusOperador {
  // Último evento antes de agora
  const passadas = marcacoes
    .filter((m) => m.timestamp <= agora)
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

  const ultimo = passadas[0]
  if (!ultimo) return 'FORA_DA_JORNADA'

  switch (ultimo.tipo) {
    case 'ENTRADA':
    case 'RETORNO_PAUSA_NR17':
    case 'RETORNO_INTERVALO':
    case 'RETORNO_PAUSA_FISIOLOGICA':
    case 'RETORNO_PAUSA_CRITICA':
    case 'ENTRADA_HE':
    case 'ENTRADA_COMPENSACAO':
      return 'TRABALHANDO'
    case 'SAIDA_PAUSA_NR17':
      return 'EM_PAUSA_NR17'
    case 'SAIDA_INTERVALO':
      return 'EM_INTERVALO'
    case 'SAIDA_PAUSA_FISIOLOGICA':
      return 'EM_PAUSA_FISIOLOGICA'
    case 'SAIDA_PAUSA_CRITICA':
      return 'EM_PAUSA_CRITICA'
    case 'SAIDA':
    case 'SAIDA_HE':
    case 'SAIDA_COMPENSACAO':
      return 'FORA_DA_JORNADA'
    default:
      return 'TRABALHANDO'
  }
}

function calcularTrabalhoContinuo(
  marcacoes: MarcacaoSimples[],
  agora: Date,
  entrada: Date,
): number {
  const passadas = marcacoes
    .filter((m) => m.timestamp <= agora)
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())

  // Encontrar o último evento que interrompeu o trabalho
  const ultimaInterrupcao = [...passadas]
    .reverse()
    .find(
      (m) =>
        m.tipo === 'SAIDA_PAUSA_NR17' ||
        m.tipo === 'SAIDA_INTERVALO' ||
        m.tipo === 'SAIDA_PAUSA_FISIOLOGICA' ||
        m.tipo === 'SAIDA_PAUSA_CRITICA',
    )

  // Encontrar o retorno após essa interrupção
  let inicioTrabalhoContinuo = entrada
  if (ultimaInterrupcao) {
    const retornoAposInterrupcao = passadas.find(
      (m) =>
        m.timestamp > ultimaInterrupcao.timestamp &&
        (m.tipo === 'RETORNO_PAUSA_NR17' ||
          m.tipo === 'RETORNO_INTERVALO' ||
          m.tipo === 'RETORNO_PAUSA_FISIOLOGICA' ||
          m.tipo === 'RETORNO_PAUSA_CRITICA'),
    )
    if (retornoAposInterrupcao) {
      inicioTrabalhoContinuo = retornoAposInterrupcao.timestamp
    } else {
      // Ainda em pausa → trabalho contínuo é 0
      return 0
    }
  }

  return Math.floor((agora.getTime() - inicioTrabalhoContinuo.getTime()) / 60000)
}

interface ParPausa {
  saida: Date
  retorno: Date
}

function encontrarParDePausa(
  marcacoes: MarcacaoSimples[],
  tipoSaida: TipoMarcacao,
  tipoRetorno: TipoMarcacao,
  _ordem: number,
): ParPausa | null {
  // Para NR-17 com múltiplas pausas do mesmo tipo, pega a ordem da ocorrência
  // _ordem é informativo — a correspondência é por sequência temporal
  const saidas = marcacoes
    .filter((m) => m.tipo === tipoSaida)
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())

  if (saidas.length === 0) return null

  // Pega a (ordem-1)-ésima saída, se existir
  const saidaAlvo = tipoSaida === 'SAIDA_PAUSA_NR17' && _ordem > 0
    ? saidas[_ordem - 1]
    : saidas[0]

  if (!saidaAlvo) return null

  const retorno = marcacoes.find(
    (m) => m.tipo === tipoRetorno && m.timestamp > saidaAlvo.timestamp,
  )

  if (!retorno) return null
  return { saida: saidaAlvo.timestamp, retorno: retorno.timestamp }
}

function verificarJanela(
  saida: Date,
  entrada: Date,
  saidaJornada: Date | null,
  config: PausaConfigNr17,
  duracaoJornadaMin: number,
): boolean {
  const minutosDesdeEntrada = Math.floor((saida.getTime() - entrada.getTime()) / 60000)

  // Primeira hora (Art. NR-17): pausas NR-17 não devem ocorrer no 1º e último 60 min
  if (minutosDesdeEntrada < 60) return false
  if (saidaJornada) {
    const minutosParaFim = Math.floor((saidaJornada.getTime() - saida.getTime()) / 60000)
    if (minutosParaFim < 60) return false
  } else {
    const minutosParaFim = duracaoJornadaMin - minutosDesdeEntrada
    if (minutosParaFim < 60) return false
  }

  if (config.janelaInicioMin !== null && minutosDesdeEntrada < config.janelaInicioMin) return false
  if (config.janelaFimMin !== null) {
    const minutosParaFim = duracaoJornadaMin - minutosDesdeEntrada
    if (minutosParaFim < config.janelaFimMin) return false
  }

  return true
}

function calcularProximaPausa(
  statusAtual: StatusOperador,
  minutosTrabalhoContinuo: number,
  pausasDia: StatusPausaDia[],
  pausasConfig: PausaConfigNr17[],
  agora: Date,
): ProximaPausa | null {
  if (statusAtual !== 'TRABALHANDO') return null

  // Pausa NR-17 obrigatória por trabalho contínuo
  const minutosRestantes = LIMITE_TRABALHO_CONTINUO_MIN - minutosTrabalhoContinuo
  if (minutosRestantes <= 0) {
    return {
      tipo: 'NR17',
      devePausarAteMs: agora.getTime(), // já deveria ter pausado
      urgente: true,
    }
  }

  // Próxima pausa NR-17 ainda não tomada
  const proxNaoTomada = pausasDia.find((p) => !p.tomada)
  if (proxNaoTomada) {
    const devePausarAteMs = agora.getTime() + minutosRestantes * 60000
    return {
      tipo: 'NR17',
      devePausarAteMs,
      urgente: minutosRestantes <= 5,
    }
  }

  return null
}
