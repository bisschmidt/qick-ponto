// Convenção de fuso do motor de apuração (single source of truth).
//
// Todos os `Date` do motor representam INSTANTES UTC. Os horários contratuais
// da jornada ("HH:MM") são horário-parede BRT (UTC-3, fixo desde o Decreto
// 9.772/2019 que extinguiu o horário de verão) e são convertidos para o
// instante UTC somando BRT_TO_UTC. As marcações já chegam como instantes UTC.
//
// Para classificar a janela noturna (art. 73 CLT, 22h–05h BRT) é preciso
// reconverter o instante UTC para a hora-parede BRT — ver utcParaHoraBrt.

export const BRT_TO_UTC = 3

// Hora-parede BRT (0–23) de um instante UTC.
export function utcParaHoraBrt(d: Date): number {
  return (d.getUTCHours() - BRT_TO_UTC + 24) % 24
}
