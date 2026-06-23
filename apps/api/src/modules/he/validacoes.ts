// Regras de bloqueio de HE — funções puras (testáveis sem banco).
// O service consulta os totais já lançados e passa para cá.

export interface JornadaDia {
  hora_inicio: string // "HH:MM"
  hora_fim: string
  dias_semana: number[] // 0=Dom..6=Sáb
}

export interface LimitesHe {
  maxMinDia: number
  maxMinSemana: number
  maxMinMes: number
  intervaloMinAposJornadaMin: number
}

export interface ValidacaoHe {
  data: Date // dia da HE (UTC)
  horaInicio: string
  horaFim: string
  jornada: JornadaDia
  limites: LimitesHe
  minutosLancadosDia: number    // HE ativas já lançadas no mesmo dia (exclui o próprio em edição)
  minutosLancadosSemana: number
  minutosLancadosMes: number
}

export type ResultadoValidacao = { ok: true } | { ok: false; erro: string }

export function minutosDe(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number) as [number, number]
  return h * 60 + m
}

// Duração em minutos; trata virada de meia-noite (fim <= início → +24h)
export function duracaoMinutos(horaInicio: string, horaFim: string): number {
  const ini = minutosDe(horaInicio)
  let fim = minutosDe(horaFim)
  if (fim <= ini) fim += 24 * 60
  return fim - ini
}

// Sobreposição de dois intervalos [aIni,aFim) e [bIni,bFim) no mesmo dia (sem virada)
function sobrepoe(aIni: number, aFim: number, bIni: number, bFim: number): boolean {
  return aIni < bFim && bIni < aFim
}

export function validarLancamentoHe(p: ValidacaoHe): ResultadoValidacao {
  const dur = duracaoMinutos(p.horaInicio, p.horaFim)
  if (dur <= 0) return { ok: false, erro: 'Horário de fim deve ser após o início' }

  const diaSemana = p.data.getUTCDay()
  const ehDiaDeTrabalho = p.jornada.dias_semana.includes(diaSemana)

  const heIni = minutosDe(p.horaInicio)
  const heFim = minutosDe(p.horaFim) <= heIni ? minutosDe(p.horaFim) + 24 * 60 : minutosDe(p.horaFim)
  const jorIni = minutosDe(p.jornada.hora_inicio)
  const jorFim = minutosDe(p.jornada.hora_fim) <= jorIni ? minutosDe(p.jornada.hora_fim) + 24 * 60 : minutosDe(p.jornada.hora_fim)

  if (ehDiaDeTrabalho) {
    // Turno diferente: HE não pode sobrepor a jornada normal
    if (sobrepoe(heIni, heFim, jorIni, jorFim)) {
      return { ok: false, erro: 'A HE deve ser em turno diferente da jornada normal do colaborador' }
    }
    // Intervalo mínimo entre jornada e HE
    let gap: number
    if (heIni >= jorFim) gap = heIni - jorFim       // HE depois da jornada
    else gap = jorIni - heFim                        // HE antes da jornada
    if (gap < p.limites.intervaloMinAposJornadaMin) {
      return {
        ok: false,
        erro: `Intervalo mínimo entre jornada e HE é de ${p.limites.intervaloMinAposJornadaMin} min (atual: ${gap} min)`,
      }
    }
    // Teto diário só se aplica em dia de escala
    if (p.minutosLancadosDia + dur > p.limites.maxMinDia) {
      return {
        ok: false,
        erro: `Limite diário de HE excedido (${formatarMin(p.limites.maxMinDia)}). Já lançado: ${formatarMin(p.minutosLancadosDia)}`,
      }
    }
  }
  // Dia sem escala (ex.: sábado fora da jornada): teto diário NÃO se aplica

  if (p.minutosLancadosSemana + dur > p.limites.maxMinSemana) {
    return {
      ok: false,
      erro: `Limite semanal de HE excedido (${formatarMin(p.limites.maxMinSemana)}). Já lançado: ${formatarMin(p.minutosLancadosSemana)}`,
    }
  }
  if (p.minutosLancadosMes + dur > p.limites.maxMinMes) {
    return {
      ok: false,
      erro: `Limite mensal de HE excedido (${formatarMin(p.limites.maxMinMes)}). Já lançado: ${formatarMin(p.minutosLancadosMes)}`,
    }
  }

  return { ok: true }
}

function formatarMin(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`
}
