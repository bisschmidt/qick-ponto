// AFD exige ISO 8859-1 (Latin-1) — NÃO UTF-8 (Portaria 671, Anexo V)
// Node.js suporta latin1 nativamente via Buffer

// Padding numérico: zeros à esquerda
export function padN(value: string | number | bigint, length: number): string {
  return String(value).padStart(length, '0').slice(0, length)
}

// Padding alfanumérico: espaços à direita
export function padA(value: string, length: number): string {
  // Transliterar caracteres fora do Latin-1 para evitar corrupção
  const sanitized = toLatin1Safe(value)
  return sanitized.padEnd(length, ' ').slice(0, length)
}

// Converter a linha para Buffer ISO 8859-1 + CRLF
export function encodeLinha(linha: string): Buffer {
  return Buffer.from(linha + '\r\n', 'latin1')
}

// Garantir que o texto é compatível com ISO 8859-1
// Caracteres acima de U+00FF são substituídos por '?'
function toLatin1Safe(text: string): string {
  let result = ''
  for (const ch of text) {
    const code = ch.charCodeAt(0)
    result += code <= 0xff ? ch : '?'
  }
  return result
}

// Formato de data simples AAAA-MM-dd
export function formatDate(date: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`
}

// Formato DH: AAAA-MM-ddThh:mm:00ZZZZZ (segundos sempre "00")
// Portaria 671 Anexo V — timestamps no fuso do estabelecimento
export function formatDH(utcDate: Date, fusoHorario: string): string {
  const fmt = new Intl.DateTimeFormat('sv-SE', {
    timeZone: fusoHorario,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  const parts = Object.fromEntries(
    fmt.formatToParts(utcDate).map((p) => [p.type, p.value]),
  )

  // Calcular offset do fuso em relação a UTC
  const offsetMin = getTimezoneOffsetMinutes(utcDate, fusoHorario)
  const sinal = offsetMin >= 0 ? '+' : '-'
  const absMin = Math.abs(offsetMin)
  const offsetHH = String(Math.floor(absMin / 60)).padStart(2, '0')
  const offsetMM = String(absMin % 60).padStart(2, '0')

  return `${parts['year']}-${parts['month']}-${parts['day']}T${parts['hour']}:${parts['minute']}:00${sinal}${offsetHH}${offsetMM}`
}

function getTimezoneOffsetMinutes(date: Date, tz: string): number {
  // Calcular offset comparando UTC com o horário local no timezone
  const utcStr = date.toLocaleString('en-US', { timeZone: 'UTC' })
  const localStr = date.toLocaleString('en-US', { timeZone: tz })
  const utcMs = new Date(utcStr).getTime()
  const localMs = new Date(localStr).getTime()
  return Math.round((localMs - utcMs) / 60000)
}
