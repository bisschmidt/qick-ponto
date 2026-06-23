// Adicional noturno — M4.4 + Art. 73 CLT
// Período: 22h–5h
// Hora reduzida: 52 minutos e 30 segundos contam como 1 hora (fator 60/52.5)
// Adicional mínimo: 20% sobre a hora diurna

const INICIO_NOTURNO_H = 22
const FIM_NOTURNO_H = 5

// Fator de hora reduzida: cada 52,5 min noturnos = 60 min pagos
export const FATOR_HORA_REDUZIDA = 60 / 52.5 // ≈ 1.1429

export interface ResultadoNoturno {
  minutosNoturnosBrutos: number  // minutos reais dentro de 22h–5h
  minutosHoraReduzida: number    // bônus de horas adicionais (diferença entre real e calculado)
}

// Calcula os minutos noturnos dentro de um intervalo [inicio, fim].
// Suporta jornadas que cruzam a meia-noite (M4.4.1).
export function calcularMinutosNoturnos(inicio: Date, fim: Date): ResultadoNoturno {
  if (fim <= inicio) return { minutosNoturnosBrutos: 0, minutosHoraReduzida: 0 }

  let minutosNoturnos = 0
  const cursor = new Date(inicio)

  // Percorre minuto a minuto para precisão nas bordas
  // Para jornadas longas isso pode ser otimizado com cálculo analítico,
  // mas para jornadas de até 24h o custo é aceitável (< 1440 iterações)
  while (cursor < fim) {
    const hora = cursor.getUTCHours()
    if (hora >= INICIO_NOTURNO_H || hora < FIM_NOTURNO_H) {
      minutosNoturnos++
    }
    cursor.setUTCMinutes(cursor.getUTCMinutes() + 1)
  }

  // Bônus de hora reduzida: cada 52,5 min noturnos vira 60 min pagos
  // O bônus é a diferença: minutosNoturnos * (60/52.5) - minutosNoturnos
  const minutosHoraReduzida = Math.round(minutosNoturnos * (FATOR_HORA_REDUZIDA - 1))

  return { minutosNoturnosBrutos: minutosNoturnos, minutosHoraReduzida }
}
