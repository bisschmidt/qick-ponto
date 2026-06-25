'use client'

import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Copy, Info } from 'lucide-react'

const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

export interface DiaHorario {
  dia_semana: number
  hora_inicio: string
  hora_fim: string
}

function duracaoMin(inicio: string, fim: string): number {
  const [hi, mi] = inicio.split(':').map(Number)
  const [hf, mf] = fim.split(':').map(Number)
  if ([hi, mi, hf, mf].some((n) => Number.isNaN(n))) return 0
  return (hf * 60 + mf) - (hi * 60 + mi)
}

function fmtDur(min: number): string {
  if (min <= 0) return '—'
  const h = Math.floor(min / 60)
  const m = min % 60
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`
}

interface Props {
  dias: number[]
  base: { inicio: string; fim: string }
  horarios: DiaHorario[]
  onChange: (h: DiaHorario[]) => void
  disabled?: boolean
  ehNR17?: boolean
}

// Editor de horário por dia da semana. Quando "porDia" está ligado, emite uma linha
// para cada dia da escala; quando desligado, emite [] e vale o horário base.
export function HorariosPorDiaEditor({ dias, base, horarios, onChange, disabled, ehNR17 }: Props) {
  const porDia = horarios.length > 0
  const diasOrdenados = [...dias].sort((a, b) => a - b)

  // valor efetivo por dia (override ou base)
  const valorDe = (d: number): { hora_inicio: string; hora_fim: string } => {
    const h = horarios.find((x) => x.dia_semana === d)
    return h ?? { hora_inicio: base.inicio, hora_fim: base.fim }
  }

  function ativarPorDia(on: boolean) {
    if (disabled) return
    if (on) {
      // materializa todos os dias da escala com o horário base
      onChange(diasOrdenados.map((d) => ({ dia_semana: d, hora_inicio: base.inicio, hora_fim: base.fim })))
    } else {
      onChange([])
    }
  }

  function setDia(d: number, campo: 'hora_inicio' | 'hora_fim', valor: string) {
    if (disabled) return
    // garante linha para todos os dias da escala antes de editar
    const base0 = diasOrdenados.map((dd) => {
      const atual = horarios.find((x) => x.dia_semana === dd) ?? { dia_semana: dd, hora_inicio: base.inicio, hora_fim: base.fim }
      return atual
    })
    onChange(base0.map((x) => (x.dia_semana === d ? { ...x, [campo]: valor } : x)))
  }

  function replicarBase() {
    if (disabled) return
    onChange(diasOrdenados.map((d) => ({ dia_semana: d, hora_inicio: base.inicio, hora_fim: base.fim })))
  }

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-700">
        <input
          type="checkbox"
          checked={porDia}
          onChange={(e) => ativarPorDia(e.target.checked)}
          disabled={disabled || diasOrdenados.length === 0}
          className="rounded"
        />
        Horário diferente por dia da semana
      </label>

      {!porDia ? (
        <p className="text-xs text-gray-500">
          Todos os dias usam o horário base ({base.inicio}–{base.fim}). Marque acima para definir, por
          exemplo, sábado em um horário diferente.
        </p>
      ) : (
        <div className="space-y-2 rounded-md border border-gray-200 p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Defina o horário de cada dia da escala</span>
            <button
              type="button"
              onClick={replicarBase}
              disabled={disabled}
              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50"
            >
              <Copy className="h-3 w-3" /> Replicar base ({base.inicio}–{base.fim})
            </button>
          </div>

          {diasOrdenados.length === 0 && (
            <p className="text-xs text-gray-400">Selecione os dias da semana primeiro.</p>
          )}

          {diasOrdenados.map((d) => {
            const v = valorDe(d)
            const dur = duracaoMin(v.hora_inicio, v.hora_fim)
            const pausasEsperadas = dur > 240 ? 2 : 1
            return (
              <div key={d} className="flex items-center gap-2 flex-wrap text-sm">
                <span className="w-20 shrink-0 text-gray-700">{DIAS[d]}</span>
                <Input
                  type="time"
                  value={v.hora_inicio}
                  onChange={(e) => setDia(d, 'hora_inicio', e.target.value)}
                  disabled={disabled}
                  className="w-32"
                />
                <span className="text-gray-400">–</span>
                <Input
                  type="time"
                  value={v.hora_fim}
                  onChange={(e) => setDia(d, 'hora_fim', e.target.value)}
                  disabled={disabled}
                  className="w-32"
                />
                <Badge variant="outline" className="text-xs">{fmtDur(dur)}</Badge>
                {ehNR17 && dur > 0 && (
                  <span className="text-xs text-gray-400">
                    NR-17: {pausasEsperadas} pausa(s) de 10 min
                  </span>
                )}
              </div>
            )
          })}

          {ehNR17 && (
            <p className="flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 rounded px-2 py-1.5 mt-1">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              A janela de pausa NR-17 é recalculada conforme o horário de cada dia. Jornadas acima de
              4h exigem 2 pausas; até 4h, 1 pausa. A validação é aplicada ao salvar.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
