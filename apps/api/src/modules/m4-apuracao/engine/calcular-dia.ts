// Motor principal de apuração diária (M4)
// Entrada: marcações brutas do dia + jornada configurada
// Saída: DiaApurado com todos os eventos classificados

import type { EntradaApuracao, DiaApurado } from '../types.js'
import {
  horarioParaDate,
  horaFimEfetiva,
  aplicarTolerancia,
} from './tolerancias.js'
import { calcularMinutosNoturnos } from './adicional-noturno.js'

export function calcularDia(entrada: EntradaApuracao): DiaApurado {
  const inconsistencias: string[] = []
  const data = entrada.data

  // ── 1. Extrair entrada e saída ────────────────────────────────────────────

  const marcacaoEntrada = entrada.marcacoes.find((m) => m.tipo === 'ENTRADA')
  const marcacaoSaida = entrada.marcacoes.find(
    (m) => m.tipo === 'SAIDA' || m.tipo === 'SAIDA_HE' || m.tipo === 'SAIDA_COMPENSACAO',
  )

  // Falta: sem nenhuma marcação no dia
  if (!marcacaoEntrada) {
    // Sem nenhuma marcação = falta legítima, não é inconsistência (não bloqueia fechamento)
    // Com outras marcações mas sem entrada = inconsistência real (bloqueia)
    const ehFaltaLegitima = entrada.marcacoes.length === 0
    return diaFalta(entrada, ehFaltaLegitima ? null : 'Sem marcação de entrada')
  }

  if (!marcacaoSaida) {
    inconsistencias.push('Par quebrado: entrada sem saída')
    // Não processa — vai para fila de exceções (M9)
    return {
      ...diaBase(entrada),
      status: 'FALTA',
      inconsistencias,
      minutosTrabalhados: 0,
      minutosHe50: 0,
      minutosHe100: 0,
      minutosAtraso: 0,
      minutosSaidaAntecipada: 0,
      minutosAdNoturno: 0,
      minutosHoraReduzida: 0,
      pausasNr17Concedidas: 0,
      pausasNr17Conformes: false,
    }
  }

  // ── 2. Horários contratuais do dia ────────────────────────────────────────

  const horaInicioContratual = horarioParaDate(data, entrada.jornada.horaInicio)
  const horaFimContratual = horaFimEfetiva(data, entrada.jornada.horaInicio, entrada.jornada.horaFim)

  // ── 3. Aplicar tolerâncias ────────────────────────────────────────────────

  const tol = aplicarTolerancia({
    entradaReal: marcacaoEntrada.timestamp,
    saidaReal: marcacaoSaida.timestamp,
    horaInicioContratual,
    horaFimContratual,
    toleranciaEntradaMin: entrada.jornada.toleranciaEntradaMin,
    toleranciaSaidaMin: entrada.jornada.toleranciaSaidaMin,
    toleranciaMaxDiaMin: 10, // Art. 58 §1º CLT — ampliável via ACT
  })

  // ── 4. Calcular pausas descontadas da jornada ─────────────────────────────

  // Apenas pausas que NÃO computam na jornada (ex.: intervalo de refeição)
  let minutosDescontados = 0

  const pausasNaoComputadas = entrada.jornada.pausas.filter((p) => !p.computaNaJornada)
  for (const pausa of pausasNaoComputadas) {
    const saidaPausa = entrada.marcacoes.find(
      (m) => m.tipo === 'SAIDA_INTERVALO',
    )
    const retornoPausa = entrada.marcacoes.find(
      (m) => m.tipo === 'RETORNO_INTERVALO',
    )

    if (saidaPausa && retornoPausa && retornoPausa.timestamp > saidaPausa.timestamp) {
      const duracaoRealMin = Math.floor(
        (retornoPausa.timestamp.getTime() - saidaPausa.timestamp.getTime()) / 60000,
      )
      // Descontar o tempo real de pausa (mínimo a duração mínima configurada)
      minutosDescontados += Math.max(duracaoRealMin, pausa.duracaoMinMin)
    }
  }

  // ── 5. Minutos trabalhados ────────────────────────────────────────────────

  const totalBrutoMin = Math.floor(
    (tol.saidaEfetiva.getTime() - tol.entradaEfetiva.getTime()) / 60000,
  )
  const minutosTrabalhados = Math.max(0, totalBrutoMin - minutosDescontados)

  // ── 6. Horas extras ──────────────────────────────────────────────────────
  // Dia normal (modelo A): HE = tempo trabalhado APÓS hora_fim (base relógio,
  // não horas líquidas) — evita inconsistência com descontos de pausa.
  // Feriado/DSR não compensado: Súmula 146 TST manda pagar TODO o tempo
  // trabalhado em dobro (100%) — inclusive a hora extra. Não há HE50 nesses dias.

  const minutosHeAposFim = Math.max(
    0,
    Math.floor((tol.saidaEfetiva.getTime() - horaFimContratual.getTime()) / 60000),
  )

  let minutosHe50 = 0
  let minutosHe100 = 0

  if (entrada.ehFeriado || entrada.ehDsr) {
    minutosHe100 = minutosTrabalhados
  } else if (minutosHeAposFim > 0) {
    minutosHe50 = minutosHeAposFim
  }

  // ── 7. Adicional noturno ──────────────────────────────────────────────────

  // Calculado sobre o período real trabalhado (entrada efetiva → saída efetiva),
  // independente do dia a que pertence a jornada (M4.4.1)
  const noturno = calcularMinutosNoturnos(tol.entradaEfetiva, tol.saidaEfetiva)

  // ── 8. Pausas NR-17 ───────────────────────────────────────────────────────

  const pausasNr17Config = entrada.jornada.pausas.filter((p) => p.ehNr17 && !p.ehIntervaloRefeicao)
  const pausasNr17Realizadas = contarPausasNr17Realizadas(entrada)
  const pausasNr17Conformes = verificarConformidadeNr17(entrada)

  // ── 9. Gap > 15h sem registro → exceção (M4.9) ───────────────────────────

  const gapMaxMs = 15 * 60 * 60 * 1000
  const gapMs = marcacaoSaida.timestamp.getTime() - marcacaoEntrada.timestamp.getTime()
  if (gapMs > gapMaxMs) {
    inconsistencias.push(`Gap de ${Math.round(gapMs / 3600000)}h entre entrada e saída — verificar`)
  }

  // ── 10. Status do dia ─────────────────────────────────────────────────────

  let status: DiaApurado['status']

  if (entrada.ehFeriado) {
    status = 'FERIADO'
  } else if (entrada.ehDsr) {
    status = 'DSR'
  } else {
    status = 'PRESENTE'
  }

  return {
    colaboradorId: entrada.colaboradorId,
    data,
    entradaReal: marcacaoEntrada.timestamp,
    saidaReal: marcacaoSaida.timestamp,
    minutosTrabalhados,
    minutosHe50,
    minutosHe100,
    minutosAtraso: tol.minutosAtraso,
    minutosSaidaAntecipada: tol.minutosSaidaAntecipada,
    minutosAdNoturno: noturno.minutosNoturnosBrutos,
    minutosHoraReduzida: noturno.minutosHoraReduzida,
    status,
    ehFeriado: entrada.ehFeriado,
    ehDsr: entrada.ehDsr,
    pausasNr17Concedidas: pausasNr17Realizadas,
    pausasNr17Conformes,
    inconsistencias,
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function diaBase(entrada: EntradaApuracao): Pick<DiaApurado, 'colaboradorId' | 'data' | 'ehFeriado' | 'ehDsr'> {
  return {
    colaboradorId: entrada.colaboradorId,
    data: entrada.data,
    ehFeriado: entrada.ehFeriado,
    ehDsr: entrada.ehDsr,
  }
}

function diaFalta(entrada: EntradaApuracao, motivo: string | null): DiaApurado {
  // DSR e feriados sem marcação são dias normais de descanso — não são inconsistência
  const ehDescanso = entrada.ehDsr || entrada.ehFeriado
  const status: DiaApurado['status'] = entrada.ehFeriado ? 'FERIADO' : entrada.ehDsr ? 'DSR' : 'FALTA'

  return {
    ...diaBase(entrada),
    status,
    minutosTrabalhados: 0,
    minutosHe50: 0,
    minutosHe100: 0,
    minutosAtraso: 0,
    minutosSaidaAntecipada: 0,
    minutosAdNoturno: 0,
    minutosHoraReduzida: 0,
    pausasNr17Concedidas: 0,
    pausasNr17Conformes: false,
    inconsistencias: (ehDescanso || motivo === null) ? [] : [motivo],
  }
}

function contarPausasNr17Realizadas(entrada: EntradaApuracao): number {
  return entrada.marcacoes.filter((m) => m.tipo === 'RETORNO_PAUSA_NR17').length
}

function verificarConformidadeNr17(entrada: EntradaApuracao): boolean {
  const pausasEsperadas = entrada.jornada.pausas.filter(
    (p) => p.ehNr17 && !p.ehIntervaloRefeicao,
  ).length

  const pausasRealizadas = contarPausasNr17Realizadas(entrada)

  return pausasRealizadas >= pausasEsperadas
}
