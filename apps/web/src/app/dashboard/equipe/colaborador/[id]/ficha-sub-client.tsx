'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { X, Edit3, Loader2, CheckCircle2, Clock, TrendingUp, Timer, UserX, Calendar, MessageSquare, XCircle, FileText, Plus } from 'lucide-react'
import { fmtMinutos } from '@/lib/utils'
import {
  criarAjusteSubordinadoAction,
  aprovarAjusteAction,
  reprovarAjusteAction,
  pedirComprovacaoAction,
  marcarSaidaAntecipadaAction,
} from './actions'

interface Ajuste {
  id: string
  status: string
  tipo_ajuste: string
  motivo: string
  justificativa: string
  novo_timestamp: string | null
  novo_tipo: string | null
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
  ajustes: Ajuste[]
}

interface Ficha {
  colaborador: { id: string; nome: string; matricula: string }
  mes: string
  jornadaContratual: { nome: string; hora_inicio: string; hora_fim: string; dias_semana: number[] } | null
  dias: DiaFicha[]
  total: { minutosTrabalhados: number; minutosHe50: number; minutosHe100: number; minutosAtraso: number; faltas: number }
}

interface Motivo { id: string; descricao: string }

const DIAS_SEMANA = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB']

const STATUS_BADGE: Record<string, { label: string; variant: 'success' | 'warning' | 'destructive' | 'secondary' }> = {
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
  AFASTAMENTO_INSS:         { label: 'Afastado', variant: 'secondary' },
  SUSPENSAO:                { label: 'Afastado', variant: 'secondary' },
  LICENCA_MATERNIDADE:      { label: 'Afastado', variant: 'secondary' },
  LICENCA_PATERNIDADE:      { label: 'Afastado', variant: 'secondary' },
  LICENCA_NAO_REMUNERADA:   { label: 'Afastado', variant: 'secondary' },
  LICENCA_OUTRAS:           { label: 'Afastado', variant: 'secondary' },
  HE:           { label: 'Hora Extra',    variant: 'success' },
  COMPENSADO:   { label: 'Compensado',    variant: 'secondary' },
  A_COMPENSAR:  { label: 'A Compensar',   variant: 'warning' },
}

const TIPO_LABEL: Record<string, string> = {
  ENTRADA: 'Entrada',
  SAIDA: 'Saída',
  SAIDA_PAUSA_NR17: 'Saída pausa NR-17',
  RETORNO_PAUSA_NR17: 'Retorno pausa NR-17',
  SAIDA_INTERVALO: 'Saída de intervalo',
  RETORNO_INTERVALO: 'Retorno de intervalo',
}

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

function hora(iso: string): string {
  const d = new Date(iso)
  const brt = new Date(d.getTime() - 3 * 3600 * 1000)
  return `${String(brt.getUTCHours()).padStart(2, '0')}:${String(brt.getUTCMinutes()).padStart(2, '0')}`
}

function mesLabel(mes: string): string {
  const [y, m] = mes.split('-').map(Number)
  const nomes = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
  return `${nomes[(m ?? 1) - 1]}/${y}`
}

type ModoModal = 'aprovar' | 'criar' | null

export function FichaSubordinadoClient({ ficha, motivos }: { ficha: Ficha; motivos: Motivo[] }) {
  const router = useRouter()
  const [diaAberto, setDiaAberto] = useState<DiaFicha | null>(null)
  const [modoModal, setModoModal] = useState<ModoModal>(null)



  function abrirDia(d: DiaFicha) {
    const temPendente = d.ajustes.some((a) => a.status === 'PENDENTE_GESTOR')
    setDiaAberto(d)
    setModoModal(temPendente ? 'aprovar' : 'criar')
  }

  function trocarMes(delta: number) {
    const [y, m] = ficha.mes.split('-').map(Number)
    if (!y || !m) return
    let nm = m + delta, ny = y
    if (nm < 1) { nm = 12; ny-- }
    if (nm > 12) { nm = 1; ny++ }
    router.push(`/dashboard/equipe/colaborador/${ficha.colaborador.id}?mes=${ny}-${String(nm).padStart(2,'0')}`)
  }

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="pt-5 pb-3 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Calendar className="h-5 w-5 text-gray-500" />
            <div>
              <p className="font-semibold text-gray-900">{ficha.colaborador.nome} — {mesLabel(ficha.mes)}</p>
              <p className="text-xs text-gray-500 font-mono">{ficha.colaborador.matricula}</p>
            </div>
          </div>
          <div className="flex gap-1">
            <button onClick={() => trocarMes(-1)} className="px-3 py-1 rounded-md text-sm bg-gray-100 hover:bg-gray-200">‹</button>
            <button onClick={() => trocarMes(1)}  className="px-3 py-1 rounded-md text-sm bg-gray-100 hover:bg-gray-200">›</button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <Stat icon={<Clock className="h-4 w-4" />}      label="Trab."   valor={fmtMinutos(ficha.total.minutosTrabalhados)} color="text-gray-900" />
        <Stat icon={<TrendingUp className="h-4 w-4" />} label="HE 50%"  valor={fmtMinutos(ficha.total.minutosHe50)}  color="text-orange-600" />
        <Stat icon={<TrendingUp className="h-4 w-4" />} label="HE 100%" valor={fmtMinutos(ficha.total.minutosHe100)} color="text-red-600" />
        <Stat icon={<Timer className="h-4 w-4" />}      label="Atrasos" valor={fmtMinutos(ficha.total.minutosAtraso)} color="text-amber-600" />
        <Stat icon={<UserX className="h-4 w-4" />}      label="Faltas"  valor={String(ficha.total.faltas)} color="text-red-600" />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="px-3 py-2 text-xs text-gray-500 border-b bg-gray-50 flex items-center gap-2">
            Clique numa linha para aprovar pendências ou registrar ajuste
            <Badge variant="warning" className="text-xs">Amarelo = aguarda sua aprovação</Badge>
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
                const temPendente = d.ajustes.some((a) => a.status === 'PENDENTE_GESTOR')
                const bgRow = temPendente
                  ? 'bg-amber-50 hover:bg-amber-100'
                  : d.ehDsr || d.ehFeriado
                    ? 'bg-gray-50/50 text-gray-400 hover:bg-gray-100'
                    : 'hover:bg-gray-100'
                return (
                  <tr key={d.data}
                    onClick={() => abrirDia(d)}
                    className={`border-b last:border-0 cursor-pointer transition-colors ${bgRow}`}>
                    <td className="px-3 py-2.5">
                      <div className="font-mono text-xs text-gray-500">{d.data.slice(8, 10)}</div>
                      <div className="text-xs text-gray-400">{DIAS_SEMANA[d.diaSemana]}</div>
                    </td>
                    {CANONICAL_COLS.map((col, i) => {
                      const m = findNthPunch(d.marcacoes, col.tipo, col.nth)
                      return (
                        <td key={i} className="py-2.5 text-center border-l border-gray-100 px-1">
                          {m
                            ? <span className="font-mono text-xs text-black whitespace-nowrap">{hora(m.hora)}</span>
                            : <span className={`text-xs ${col.group === 'Intervalo' ? 'text-orange-200' : 'text-gray-200'}`}>—</span>
                          }
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
                      <div className="flex items-center justify-end gap-1 flex-wrap">
                        {temPendente && <Badge variant="warning">Pendente</Badge>}
                        {!temPendente && <Badge variant={s.variant}>{s.label}</Badge>}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {diaAberto && modoModal === 'aprovar' && (
        <ModalAprovarAjuste
          dia={diaAberto}
          colaboradorId={ficha.colaborador.id}
          motivos={motivos}
          onClose={() => { setDiaAberto(null); setModoModal(null) }}
          onOk={() => { setDiaAberto(null); setModoModal(null); router.refresh() }}
          onCriarNovo={() => setModoModal('criar')}
        />
      )}

      {diaAberto && modoModal === 'criar' && (
        <ModalCriarAjuste
          colaboradorId={ficha.colaborador.id}
          dia={diaAberto}
          motivos={motivos}
          onClose={() => { setDiaAberto(null); setModoModal(null) }}
          onOk={() => { setDiaAberto(null); setModoModal(null); router.refresh() }}
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

// Modal para gestor APROVAR/REPROVAR ajustes pendentes do subordinado
function ModalAprovarAjuste({
  dia, colaboradorId, motivos, onClose, onOk, onCriarNovo,
}: {
  dia: DiaFicha
  colaboradorId: string
  motivos: Motivo[]
  onClose: () => void
  onOk: () => void
  onCriarNovo: () => void
}) {
  const pendentes = dia.ajustes.filter((a) => a.status === 'PENDENTE_GESTOR')
  const [obs, setObs] = useState('')
  const [abertoObs, setAbertoObs] = useState<'reprovar' | 'comprovacao' | null>(null)
  const [ajusteAtivo, setAjusteAtivo] = useState<Ajuste | null>(pendentes[0] ?? null)
  const [erro, setErro] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function aprovar() {
    if (!ajusteAtivo) return
    startTransition(async () => {
      const r = await aprovarAjusteAction(ajusteAtivo.id)
      if (!r.ok) { setErro(r.error); return }
      onOk()
    })
  }

  function reprovar() {
    if (!ajusteAtivo || obs.trim().length < 3) return
    startTransition(async () => {
      const r = await reprovarAjusteAction(ajusteAtivo.id, obs.trim())
      if (!r.ok) { setErro(r.error); return }
      onOk()
    })
  }

  function pedirComp() {
    if (!ajusteAtivo || obs.trim().length < 3) return
    startTransition(async () => {
      const r = await pedirComprovacaoAction(ajusteAtivo.id, obs.trim())
      if (!r.ok) { setErro(r.error); return }
      onOk()
    })
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md">
        <Card>
          <CardContent className="p-0">
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <p className="font-semibold text-gray-900">Aprovações — dia {dia.data.split('-').reverse().join('/')}</p>
                <p className="text-xs text-gray-500">{pendentes.length} solicitação(ões) aguardando</p>
              </div>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>

            <div className="p-4 space-y-4">
              {/* Seletor de ajuste se houver mais de um */}
              {pendentes.length > 1 && (
                <div className="flex gap-2 flex-wrap">
                  {pendentes.map((a, i) => (
                    <button
                      key={a.id}
                      onClick={() => { setAjusteAtivo(a); setAbertoObs(null); setObs('') }}
                      className={`px-3 py-1 rounded-full text-xs border ${ajusteAtivo?.id === a.id ? 'bg-amber-100 border-amber-400 text-amber-800' : 'bg-white border-gray-200 text-gray-500'}`}
                    >
                      Solicitação {i + 1}
                    </button>
                  ))}
                </div>
              )}

              {ajusteAtivo && (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    {ajusteAtivo.tipo_ajuste === 'ATESTADO'
                      ? <FileText className="h-4 w-4 text-green-600" />
                      : <Edit3 className="h-4 w-4 text-gray-900" />
                    }
                    <span className="font-medium text-sm text-gray-800">{ajusteAtivo.motivo}</span>
                  </div>
                  {ajusteAtivo.novo_tipo && ajusteAtivo.novo_timestamp && (
                    <p className="text-xs text-black bg-gray-100 rounded px-2 py-1">
                      Pedido: <strong>{TIPO_LABEL[ajusteAtivo.novo_tipo] ?? ajusteAtivo.novo_tipo}</strong> às <strong>{hora(ajusteAtivo.novo_timestamp)}</strong>
                    </p>
                  )}
                  <p className="text-sm text-gray-600 italic">"{ajusteAtivo.justificativa}"</p>
                </div>
              )}

              {erro && <p className="text-sm text-red-600">{erro}</p>}

              {abertoObs === null && (
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" onClick={aprovar} disabled={pending}>
                    {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    Aprovar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setAbertoObs('comprovacao')} disabled={pending}>
                    <MessageSquare className="h-4 w-4" /> Pedir comprovação
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => setAbertoObs('reprovar')} disabled={pending}>
                    <XCircle className="h-4 w-4" /> Reprovar
                  </Button>
                </div>
              )}

              {abertoObs !== null && (
                <div className="space-y-2 p-3 bg-gray-50 rounded-md">
                  <label className="text-xs font-medium text-gray-700">
                    {abertoObs === 'reprovar' ? 'Motivo da reprovação' : 'O que você precisa?'}
                  </label>
                  <textarea
                    value={obs}
                    onChange={(e) => setObs(e.target.value)}
                    rows={2}
                    className="w-full rounded-md border px-3 py-2 text-sm"
                    placeholder={abertoObs === 'reprovar' ? 'Ex: Sem comprovação suficiente' : 'Ex: Envie foto do contracheque'}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => { setAbertoObs(null); setObs('') }}>Cancelar</Button>
                    <Button size="sm" onClick={abertoObs === 'reprovar' ? reprovar : pedirComp} disabled={pending}>
                      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                      Enviar
                    </Button>
                  </div>
                </div>
              )}

              {dia.status === 'PONTO_SEM_SAIDA' && (
                <BotaoSaidaAntecipada colaboradorId={colaboradorId} dia={dia} onOk={onOk} />
              )}

              <div className="pt-2 border-t">
                <button
                  onClick={onCriarNovo}
                  className="flex items-center gap-1 text-xs text-gray-900 hover:text-black"
                >
                  <Plus className="h-3 w-3" /> Registrar novo ajuste neste dia
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// Modal para gestor CRIAR novo ajuste em nome do subordinado
function ModalCriarAjuste({
  colaboradorId, dia, motivos, onClose, onOk,
}: {
  colaboradorId: string
  dia: DiaFicha
  motivos: Motivo[]
  onClose: () => void
  onOk: () => void
}) {
  const [motivoId, setMotivoId] = useState('')
  const [tipo, setTipo] = useState('CORRIGIR_HORARIO')
  const [novoHorario, setNovoHorario] = useState('08:00')
  const [novoTipoMarcacao, setNovoTipoMarcacao] = useState('ENTRADA')
  const [justificativa, setJustificativa] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function enviar() {
    setErro(null)
    if (!motivoId) { setErro('Selecione um motivo'); return }
    if (justificativa.trim().length < 3) { setErro('Descreva o ajuste'); return }
    startTransition(async () => {
      const r = await criarAjusteSubordinadoAction({
        colaborador_id: colaboradorId,
        motivo_id: motivoId,
        data_ponto: dia.data,
        tipo_ajuste: tipo,
        justificativa: justificativa.trim(),
        novo_timestamp: tipo !== 'JUSTIFICAR_FALTA'
          ? new Date(`${dia.data}T${novoHorario}:00-03:00`).toISOString()
          : undefined,
        novo_tipo: tipo !== 'JUSTIFICAR_FALTA' ? novoTipoMarcacao : undefined,
      })
      if (!r.ok) { setErro(r.error); return }
      onOk()
    })
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md">
        <Card>
          <CardContent className="p-0">
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <p className="font-semibold text-gray-900">Registrar ajuste — dia {dia.data.split('-').reverse().join('/')}</p>
                <p className="text-xs text-gray-500">Em nome do colaborador — vai direto para o RH</p>
              </div>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>

            <div className="p-4 space-y-3">
              {dia.status === 'PONTO_SEM_SAIDA' && (
                <BotaoSaidaAntecipada colaboradorId={colaboradorId} dia={dia} onOk={onOk} />
              )}

              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700">Motivo</label>
                <select value={motivoId} onChange={(e) => setMotivoId(e.target.value)}
                  className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm">
                  <option value="">Selecione…</option>
                  {motivos.map((m) => <option key={m.id} value={m.id}>{m.descricao}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700">Tipo de ajuste</label>
                <select value={tipo} onChange={(e) => setTipo(e.target.value)}
                  className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm">
                  <option value="CORRIGIR_HORARIO">Corrigir horário</option>
                  <option value="ESQUECIMENTO">Marcação esquecida (adicionar)</option>
                  <option value="JUSTIFICAR_FALTA">Justificar falta</option>
                </select>
              </div>
              {tipo !== 'JUSTIFICAR_FALTA' && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-700">Tipo da marcação</label>
                    <select value={novoTipoMarcacao} onChange={(e) => setNovoTipoMarcacao(e.target.value)}
                      className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm">
                      <option value="ENTRADA">Entrada</option>
                      <option value="SAIDA">Saída</option>
                      <option value="SAIDA_PAUSA_NR17">Saída pausa NR-17</option>
                      <option value="RETORNO_PAUSA_NR17">Retorno pausa NR-17</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-700">Horário</label>
                    <Input type="time" value={novoHorario} onChange={(e) => setNovoHorario(e.target.value)} />
                  </div>
                </div>
              )}
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700">Justificativa</label>
                <textarea value={justificativa} onChange={(e) => setJustificativa(e.target.value)} rows={3}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="Ex: Colaborador esqueceu de bater saída — confirmou verbalmente." />
              </div>
              {erro && <p className="text-sm text-red-600">{erro}</p>}
              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={onClose} disabled={pending} className="flex-1">Cancelar</Button>
                <Button onClick={enviar} disabled={pending} className="flex-1">
                  {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Edit3 className="h-4 w-4" />}
                  Registrar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function BotaoSaidaAntecipada({ colaboradorId, dia, onOk }: { colaboradorId: string; dia: DiaFicha; onOk: () => void }) {
  const [aberto, setAberto] = useState(false)
  const [justificativa, setJustificativa] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  if (!aberto) {
    return (
      <div className="rounded-md border border-orange-200 bg-orange-50 p-3 flex items-center justify-between gap-2">
        <p className="text-xs text-orange-800 font-medium">Dia sem marcação de saída</p>
        <Button size="sm" variant="outline" className="text-orange-700 border-orange-300 hover:bg-orange-100 shrink-0" onClick={() => setAberto(true)}>
          Marcar Saída Antecipada
        </Button>
      </div>
    )
  }

  return (
    <div className="rounded-md border border-orange-200 bg-orange-50 p-3 space-y-2">
      <p className="text-xs font-medium text-orange-800">Confirmar Saída Antecipada — dia {dia.data.split('-').reverse().join('/')}</p>
      <textarea
        value={justificativa}
        onChange={(e) => setJustificativa(e.target.value)}
        rows={2}
        className="w-full rounded-md border px-3 py-2 text-sm"
        placeholder="Ex: Funcionário confirmou que saiu às 17h mas não bateu saída."
      />
      {erro && <p className="text-xs text-red-600">{erro}</p>}
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => { setAberto(false); setErro(null) }} disabled={pending}>Cancelar</Button>
        <Button size="sm" className="bg-orange-600 hover:bg-orange-700" onClick={() => {
          if (justificativa.trim().length < 3) { setErro('Descreva o motivo'); return }
          startTransition(async () => {
            const r = await marcarSaidaAntecipadaAction(colaboradorId, dia.data, justificativa.trim())
            if (!r.ok) { setErro(r.error); return }
            onOk()
          })
        }} disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Confirmar
        </Button>
      </div>
    </div>
  )
}
