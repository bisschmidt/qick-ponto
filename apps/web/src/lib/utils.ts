import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function fmtHora(date: Date | string): string {
  return new Date(date).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  })
}

export function fmtData(date: Date | string): string {
  return new Date(date).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo',
  })
}

export function fmtDataCurta(date: Date | string | null | undefined): string {
  if (!date) return '—'
  // Qualquer string que começa com YYYY-MM-DD → data pura, sem conversão de fuso
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(date)) {
    const [y, m, d] = date.slice(0, 10).split('-')
    return `${d}/${m}/${y}`
  }
  const dt = new Date(date)
  if (isNaN(dt.getTime())) return '—'
  return dt.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo',
  })
}

export function fmtMinutos(minutos: number): string {
  const h = Math.floor(Math.abs(minutos) / 60)
  const m = Math.abs(minutos) % 60
  const sinal = minutos < 0 ? '-' : ''
  return `${sinal}${h}h${m.toString().padStart(2, '0')}m`
}
