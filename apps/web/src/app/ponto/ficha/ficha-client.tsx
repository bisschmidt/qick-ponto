'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Clock, TrendingUp, Timer, UserX, Calendar, Plus } from 'lucide-react'
import { fmtMinutos } from '@/lib/utils'
import { ModalAjusteDia } from './modal-ajuste-dia'

interface Slot {
  tipo: string
  hora: string
  nsr: string
}

interface DiaFicha {
  data: string
  diaSemana: number
  ehFeriado: boolean
  ehDsr: boolean
  status: string
  jornadaContratual: { inicio: string; fim: string } | null
  marcacoes: { tipo: string; hora: string; nsr: string }[]
  totais: { minutosTrabalhados: number; minutosHe50: number; minutosHe100: number; minutosAtraso: number }
  inconsistencias: string[]
  ajustes: { id: string; status: string; tipo_ajuste: string; motivo: string; justificativa: string; novo_timestamp: string | null; novo_tipo: string | null }[]
}

interface Ficha {
  colaborador: { id: string; nome: string; matricula: string }
  mes: string
  jornadaContratual: { nome: string; hora_inicio: string; hora_fim: string; dias_semana: number[] } | null
  dias: DiaFicha[]
  total: { minutosTrabalhados: number; minutosHe50: number; minutosHe100: number; minutosAtraso: number; faltas: number }
}

const DIAS_SEMANA = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB']

// Sequência canônica fixa da jornada NR-17 call center
const CANONICAL_COLS = [
  { tipo: 'ENTRADA',             nth: 0, group: 'Entrada',    sub: 'Entrada',  color: 'text-green-700' },
  { tipo: 'SAIDA_PAUSA_NR17',    nth: 0, group: 'Pausa NR1',  sub: 'Início',   color: 'text-purple-600' },
  { tipo: 'RETORNO_PAUSA_NR17',  nth: 0, group: 'Pausa NR1',  sub: 'Fim',      color: 'text-purple-600' },
  { tipo: 'SAIDA_INTERVALO',     nth: 0, group: 'Intervalo',  sub: 'Início',   color: 'text-orange-600' },
  { tipo: 'RETORNO_INTERVALO',   nth: 0, group: 'Intervalo',  sub: 'Fim',      color: 'text-orange-600' },
  { tipo: 'SAIDA_PAUSA_NR17',    nth: 1, group: 'Pausa NR2',  sub: 'Início',   color: 'text-purple-600' },
  { tipo: 'RETORNO_PAUSA_NR17',  nth: 1, group: 'Pausa NR2',  sub: 'Fim',      color: 'text-purple-600' },
  { tipo: 'SAIDA',               nth: 0, group: 'Saída',      sub: 'Saída',    color: 'text-red-600' },
] as const

// Agrupa colunas adjacentes com mesmo group
const CANONICAL_GROUPS = CANONICAL_COLS.reduce<{ label: string; cols: number }[]>((acc, col) => {
  const last = acc[acc.length - 1]
  if (last && last.label === col.group) { last.cols++ } else { acc.push({ label: col.group, cols: 1 }) }
  return acc
}, [])

function findNthPunch(marcacoes: { tipo: string; hora: string; nsr: string }[], tipo: string, nth: number) {
  let count = 0
  for (const m of marcacoes) {
    if (m.tipo === tipo) { if (count === nth) return m; count++ }
  }
  return undefined
}
const STATUS_BADGE: Record<string, { label: string; variant: 'success' | 'warning' | 'destructive' | 'secondary' }> = {
  // Status computados pelo portal-service
  OK:               { label: 'Presença',          variant: 'success' },
  PRESENTE:         { label: 'Presença',          variant: 'success' },
  INCOMPLETO:       { label: 'Incompleto',        variant: 'warning' },
  PONTO_SEM_SAIDA:  { label: 'Sem Saída',         variant: 'warning' },
  SAIDA_ANTECIPADA: { label: 'Saída Antecipada',  variant: 'secondary' },
  FALTA:            { label: 'Falta Injustificada',variant: 'destructive' },
  ATESTADO:         { label: 'Atestado',           variant: 'secondary' },
  FERIADO:          { label: 'Feriado',            variant: 'secondary' },
  DSR:              { label: 'DSR',                variant: 'secondary' },
  FERIAS:           { label: 'Férias',             variant: 'secondary' },
  FOLGA:            { label: 'Folga',              variant: 'secondary' },
  DESLIGADO:        { label: 'Desligado',          variant: 'secondary' },
  // Afastamentos agrupados gerencialmente como "Afastado"
  AFASTAMENTO_INSS:         { label: 'Afastado', variant: 'secondary' },
  SUSPENSAO:                { label: 'Afastado', variant: 'secondary' },
  LICENCA_MATERNIDADE:      { label: 'Afastado', variant: 'secondary' },
  LICENCA_PATERNIDADE:      { label: 'Afastado', variant: 'secondary' },
  LICENCA_NAO_REMUNERADA:   { label: 'Afastado', variant: 'secondary' },
  LICENCA_OUTRAS:           { label: 'Afastado', variant: 'secondary' },
  // Banco de horas
  HE:           { label: 'Hora Extra',    variant: 'success' },
  COMPENSADO:   { label: 'Compensado',    variant: 'secondary' },
  A_COMPENSAR:  { label: 'A Compensar',   variant: 'warning' },
}

function hora(iso: string): string {
  const d = new Date(iso)
  const brt = new Date(d.getTime() - 3 * 3600 * 1000)
  return `${String(brt.getUTCHours()).padStart(2, '0')}:${String(brt.getUTCMinutes()).padStart(2, '0')}`
}


function mesLabel(mes: string): string {
  const [y, m] = mes.split('-').map(Number)
  const nomes = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
  return `${nomes[(m ?? 1) - 1]} ${y}`
}

export function FichaPontoClient({ ficha }: { ficha: Ficha }) {
  const router = useRouter()
  const [diaAberto, setDiaAberto] = useState<DiaFicha | null>(null)
  const [slotAberto, setSlotAberto] = useState<Slot | null>(null)

  function trocarMes(delta: number) {
    const [y, m] = ficha.mes.split('-').map(Number)
    if (!y || !m) return
    let novoM = m + delta
    let novoY = y
    if (novoM < 1) { novoM = 12; novoY-- }
    if (novoM > 12) { novoM = 1; novoY++ }
    const novo = `${novoY}-${String(novoM).padStart(2, '0')}`
    router.push(`/ponto/ficha?mes=${novo}`)
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Header com seletor de mês */}
      <Card>
        <CardContent className="pt-6 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Calendar className="h-5 w-5 text-gray-500" />
            <div>
              <p className="font-semibold text-gray-900 capitalize">{mesLabel(ficha.mes)}</p>
              <p className="text-xs text-gray-500">
                {ficha.colaborador.nome} · {ficha.colaborador.matricula}
              </p>
            </div>
          </div>
          <div className="flex gap-1">
            <button onClick={() => trocarMes(-1)} className="px-3 py-1.5 rounded-md text-sm bg-gray-100 hover:bg-gray-200">‹ Mês anterior</button>
            <button onClick={() => trocarMes(1)}  className="px-3 py-1.5 rounded-md text-sm bg-gray-100 hover:bg-gray-200">Próximo mês ›</button>
          </div>
        </CardContent>
      </Card>

      {/* Totais do mês */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <Stat icon={<Clock className="h-4 w-4" />} label="Trabalhadas" valor={fmtMinutos(ficha.total.minutosTrabalhados)} color="text-gray-900" />
        <Stat icon={<TrendingUp className="h-4 w-4" />} label="HE 50%"     valor={fmtMinutos(ficha.total.minutosHe50)}  color="text-orange-600" />
        <Stat icon={<TrendingUp className="h-4 w-4" />} label="HE 100%"    valor={fmtMinutos(ficha.total.minutosHe100)} color="text-red-600" />
        <Stat icon={<Timer className="h-4 w-4" />}     label="Atrasos"     valor={fmtMinutos(ficha.total.minutosAtraso)} color="text-amber-600" />
        <Stat icon={<UserX className="h-4 w-4" />}     label="Faltas"      valor={String(ficha.total.faltas)} color="text-red-600" />
      </div>

      {/* Tabela ficha */}
      <Card>
        <CardContent className="p-0">
          <div className="px-3 py-2 text-xs text-gray-500 border-b bg-gray-50">
            Clique em um horário para ajustar · Clique em <strong>+</strong> para incluir marcação ou justificar
          </div>
          <table className="w-full text-sm">
            <thead className="text-xs text-gray-500 uppercase sticky top-0 bg-white z-10 shadow-sm">
              <tr className="border-b-0">
                <th className="text-left px-3 py-1.5 font-medium" rowSpan={2}>Dia</th>
                {CANONICAL_GROUPS.map((g, i) => (
                  <th key={i} colSpan={g.cols} className="text-center px-1 py-1.5 font-medium border-l border-gray-100">
                    {g.label}
                  </th>
                ))}
                <th className="text-right px-3 py-1.5 font-medium border-l border-gray-100" rowSpan={2}>Trab.</th>
                <th className="text-right px-3 py-1.5 font-medium" rowSpan={2}>HE</th>
                <th className="text-right px-3 py-1.5 font-medium" rowSpan={2}>Atraso</th>
                <th className="text-right px-3 py-1.5 font-medium" rowSpan={2}>Status</th>
              </tr>
              <tr className="border-b">
                {CANONICAL_COLS.map((col, i) => (
                  <th key={i} className={`text-center px-1 py-0.5 font-normal text-[10px] normal-case ${col.color} border-l border-gray-100`}>
                    {col.sub}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ficha.dias.map((d) => {
                const s = STATUS_BADGE[d.status] ?? { label: d.status, variant: 'secondary' as const }
                const heTotal = d.totais.minutosHe50 + d.totais.minutosHe100
                const ajustePendente = d.ajustes.find((a) => a.status.startsWith('PENDENTE'))
                const ajusteAprovado = d.ajustes.find((a) => a.status === 'APROVADO_RH')

                return (
                  <tr
                    key={d.data}
                    className={`border-b last:border-0 ${d.ehDsr || d.ehFeriado ? 'bg-gray-50/50 text-gray-400' : ''}`}
                  >
                    <td className="px-3 py-2.5">
                      <div className="font-mono text-xs text-gray-500">{d.data.slice(8, 10)}</div>
                      <div className="text-xs text-gray-400">{DIAS_SEMANA[d.diaSemana]}</div>
                    </td>
                    {CANONICAL_COLS.map((col, i) => {
                      const m = findNthPunch(d.marcacoes, col.tipo, col.nth)
                      const isInterval = col.group === 'Intervalo'
                      return (
                        <td key={i} className="py-2.5 text-center border-l border-gray-100 px-1">
                          {m ? (
                            <button
                              title="Clique para solicitar ajuste"
                              onClick={(e) => { e.stopPropagation(); setDiaAberto(d); setSlotAberto({ tipo: m.tipo, hora: hora(m.hora), nsr: m.nsr }) }}
                              className="font-mono text-xs text-blue-700 hover:bg-blue-100 rounded px-1 py-0.5 transition-colors"
                            >
                              {hora(m.hora)}
                            </button>
                          ) : (
                            <button
                              title={isInterval ? 'Sem registro de intervalo' : 'Solicitar inclusão'}
                              onClick={(e) => { e.stopPropagation(); setDiaAberto(d); setSlotAberto(null) }}
                              className={`transition-colors ${isInterval ? 'text-orange-200 hover:text-orange-400' : 'text-gray-200 hover:text-gray-400'}`}
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          )}
                        </td>
                      )
                    })}
                    <td className="px-3 py-2.5 text-right font-mono text-xs">
                      {d.totais.minutosTrabalhados > 0 ? fmtMinutos(d.totais.minutosTrabalhados) : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs">
                      {heTotal > 0 ? <span className="text-orange-600">{fmtMinutos(heTotal)}</span> : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-xs">
                      {d.totais.minutosAtraso > 0 ? <span className="text-amber-600">{fmtMinutos(d.totais.minutosAtraso)}</span> : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="flex items-center gap-1 justify-end">
                        {ajustePendente && <Badge variant="warning">Aguardando</Badge>}
                        {ajusteAprovado && <Badge variant="success">{ajusteAprovado.motivo.slice(0, 12)}</Badge>}
                        {!ajustePendente && !ajusteAprovado && <Badge variant={s.variant}>{s.label}</Badge>}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {diaAberto && (
        <ModalAjusteDia
          dia={diaAberto}
          colaboradorId={ficha.colaborador.id}
          slotInicial={slotAberto ?? undefined}
          temMarcacoes={diaAberto.marcacoes.length > 0}
          onClose={() => { setDiaAberto(null); setSlotAberto(null) }}
          onSucesso={() => { setDiaAberto(null); setSlotAberto(null); router.refresh() }}
        />
      )}
    </div>
  )
}

function Stat({ icon, label, valor, color }: { icon: React.ReactNode; label: string; valor: string; color: string }) {
  return (
    <Card>
      <CardContent className="py-3 px-3 space-y-0.5">
        <div className="flex items-center gap-1 text-gray-500 text-xs">{icon}{label}</div>
        <p className={`text-base font-bold ${color}`}>{valor}</p>
      </CardContent>
    </Card>
  )
}
