// Aplicação das tolerâncias de marcação (M4.2 + Art. 58 §1º CLT)
// Regra: ±5 min por marcação, máximo 10 min/dia.
// Quando o atraso EXCEDE a tolerância, conta-se o período INTEGRAL (não só o excedente).

export interface ResultadoTolerancia {
  minutosAtraso: number
  minutosSaidaAntecipada: number
  // Horários ajustados após aplicar tolerância (para calcular horas trabalhadas)
  entradaEfetiva: Date
  saidaEfetiva: Date
}

// Horários de jornada são em BRT (UTC-3, sem DST desde Decreto 9.772/2019).
// 'dia' é sempre meia-noite UTC (ex.: 2026-04-28T00:00:00Z).
// Somar 3h converte BRT→UTC:  08:40 BRT = setUTCHours(11,40) = 11:40 UTC.
// O overflow é tratado pelo JS: 22:00 BRT = setUTCHours(25,0) → 01:00 UTC próximo dia.
const BRT_TO_UTC = 3

export function horarioParaDate(dia: Date, horario: string): Date {
  const [h, m] = horario.split(':').map(Number)
  if (h === undefined || m === undefined) throw new Error(`Horário inválido: ${horario}`)
  const d = new Date(dia)
  d.setUTCHours(h + BRT_TO_UTC, m, 0, 0)
  return d
}

// Quando a hora de fim é menor que a de início, a jornada cruza a meia-noite
export function horaFimEfetiva(dia: Date, horaInicio: string, horaFim: string): Date {
  const inicio = horarioParaDate(dia, horaInicio)
  let fim = horarioParaDate(dia, horaFim)
  if (fim <= inicio) {
    fim = new Date(fim.getTime() + 24 * 60 * 60 * 1000)
  }
  return fim
}

export function aplicarTolerancia(params: {
  entradaReal: Date
  saidaReal: Date
  horaInicioContratual: Date
  horaFimContratual: Date
  toleranciaEntradaMin: number
  toleranciaSaidaMin: number
  toleranciaMaxDiaMin: number // padrão 10
}): ResultadoTolerancia {
  const {
    entradaReal,
    saidaReal,
    horaInicioContratual,
    horaFimContratual,
    toleranciaEntradaMin,
    toleranciaSaidaMin,
    toleranciaMaxDiaMin,
  } = params

  const diffEntradaMs = entradaReal.getTime() - horaInicioContratual.getTime()
  const diffSaidaMs = horaFimContratual.getTime() - saidaReal.getTime()

  const atrasoBrutoMin = Math.floor(diffEntradaMs / 60000)
  const saidaAntecipBrutoMin = Math.floor(diffSaidaMs / 60000)

  // Tolerância na entrada
  let minutosAtraso = 0
  let entradaEfetiva = entradaReal

  if (atrasoBrutoMin > 0) {
    if (atrasoBrutoMin <= toleranciaEntradaMin) {
      // Dentro da tolerância — entrada conta como no horário
      entradaEfetiva = horaInicioContratual
    } else {
      // Excedeu tolerância — conta o período INTEGRAL (Art. 58 §1º CLT)
      minutosAtraso = atrasoBrutoMin
      entradaEfetiva = entradaReal
    }
  } else {
    // Entrada antes do horário — cômputo começa no horário contratual
    entradaEfetiva = horaInicioContratual
  }

  // Tolerância na saída
  let minutosSaidaAntecipada = 0
  let saidaEfetiva = saidaReal

  if (saidaAntecipBrutoMin > 0) {
    if (saidaAntecipBrutoMin <= toleranciaSaidaMin) {
      saidaEfetiva = horaFimContratual
    } else {
      minutosSaidaAntecipada = saidaAntecipBrutoMin
      saidaEfetiva = saidaReal
    }
  } else {
    // Saída após o horário — possível HE (calculado no engine principal)
    saidaEfetiva = saidaReal
  }

  // Limite diário de tolerância: soma das variações ≤ 10 min (Art. 58 §1º CLT)
  const totalVariacaoMin = (atrasoBrutoMin > 0 && atrasoBrutoMin <= toleranciaEntradaMin ? atrasoBrutoMin : 0) +
    (saidaAntecipBrutoMin > 0 && saidaAntecipBrutoMin <= toleranciaSaidaMin ? saidaAntecipBrutoMin : 0)

  if (totalVariacaoMin > toleranciaMaxDiaMin) {
    // Tolerância diária excedida — não aplica nenhuma tolerância
    minutosAtraso = atrasoBrutoMin > 0 ? atrasoBrutoMin : 0
    minutosSaidaAntecipada = saidaAntecipBrutoMin > 0 ? saidaAntecipBrutoMin : 0
    entradaEfetiva = entradaReal
    saidaEfetiva = saidaReal
  }

  return { minutosAtraso, minutosSaidaAntecipada, entradaEfetiva, saidaEfetiva }
}
