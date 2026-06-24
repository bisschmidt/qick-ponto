'use client'

import { useState, useEffect, useTransition } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Clock, Plus, X, Loader2, CheckCircle2, XCircle, Calendar, TrendingUp, AlertTriangle, Trash2, CalendarClock } from 'lucide-react'
import { fmtDataCurta } from '@/lib/utils'
import {
  lancarHeAction,
  ajustarHeAction,
  cancelarHeAction,
  aprovarCompensacaoAction,
  reprovarCompensacaoAction,
  getJornadaColaboradorAction,
  criarCompensacaoGestorAction,
} from './actions'

// Helpers de slots de compensação
function cToMin(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number) as [number, number]
  return h * 60 + m
}
function cDur(hi: string, hf: string): number {
  return Math.max(0, cToMin(hf) - cToMin(hi))
}
function cAddMin(hhmm: string, min: number): string {
  let t = (cToMin(hhmm) + min) % 1440
  if (t < 0) t += 1440
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}
function cFmt(min: number): string {
  const h = Math.floor(min / 60), m = min % 60
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`
}
function cWeekday(dateStr: string): number {
  return new Date(`${dateStr}T12:00:00Z`).getUTCDay()
}

interface ColabRef { id: string; nome_completo: string; matricula: string }
interface HeView {
  id: string
  colaborador: ColabRef
  data: string
  hora_inicio: string
  hora_fim: string
  tipo: string
  status: string
  compensacao_id: string | null
  motivo: string | null
}
interface CompPendente {
  id: string
  colaborador: ColabRef
  data_falta: string
  motivo: string
  dias: { data: string; hora_inicio: string; hora_fim: string }[]
}
interface HeTime {
  aguardandoAceite: HeView[]
  aguardandoMarcacao: HeView[]
  realizadas: HeView[]
  faltaHe: HeView[]
  compensacoesPendentes: CompPendente[]
}
interface Membro { id: string; nome_completo: string; matricula: string }

type Aba = 'aceite' | 'marcacao' | 'realizadas' | 'falta' | 'compensacoes'

const TIPO_BADGE: Record<string, { label: string; variant: 'success' | 'secondary' }> = {
  REMUNERADA:  { label: 'Remunerada', variant: 'success' },
  COMPENSACAO: { label: 'Compensação', variant: 'secondary' },
}

export function HeClient({ time, membros }: { time: HeTime; membros: Membro[] }) {
  const [aba, setAba] = useState<Aba>('aceite')
  const [modalAberto, setModalAberto] = useState(false)
  const [modalComp, setModalComp] = useState(false)

  const totais = {
    aceite: time.aguardandoAceite.length,
    marcacao: time.aguardandoMarcacao.length,
    realizadas: time.realizadas.length,
    falta: time.faltaHe.length,
    compensacoes: time.compensacoesPendentes.length,
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Horas Extras</h1>
          <p className="text-sm text-gray-500 mt-1">HE planejada, compensações e marcações do time</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setModalComp(true)}>
            <CalendarClock className="h-4 w-4" /> Lançar Compensação
          </Button>
          <Button onClick={() => setModalAberto(true)}>
            <Plus className="h-4 w-4" /> Lançar HE
          </Button>
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <Stat label="Aguard. aceite" valor={totais.aceite} color="text-amber-600" />
        <Stat label="A marcar"       valor={totais.marcacao} color="text-blue-600" />
        <Stat label="Realizadas"     valor={totais.realizadas} color="text-green-600" />
        <Stat label="Falta HE"       valor={totais.falta} color="text-gray-500" />
        <Stat label="Compensações"   valor={totais.compensacoes} color="text-purple-600" />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b flex-wrap">
        <TabBtn active={aba === 'aceite'} onClick={() => setAba('aceite')}>Aguardando aceite ({totais.aceite})</TabBtn>
        <TabBtn active={aba === 'marcacao'} onClick={() => setAba('marcacao')}>A marcar ({totais.marcacao})</TabBtn>
        <TabBtn active={aba === 'realizadas'} onClick={() => setAba('realizadas')}>Realizadas ({totais.realizadas})</TabBtn>
        <TabBtn active={aba === 'falta'} onClick={() => setAba('falta')}>Falta HE ({totais.falta})</TabBtn>
        <TabBtn active={aba === 'compensacoes'} onClick={() => setAba('compensacoes')}>Compensações ({totais.compensacoes})</TabBtn>
      </div>

      {aba === 'aceite' && <ListaHe hes={time.aguardandoAceite} vazio="Nenhuma HE aguardando aceite" editavel />}
      {aba === 'marcacao' && <ListaHe hes={time.aguardandoMarcacao} vazio="Nenhuma HE aguardando marcação" editavel />}
      {aba === 'realizadas' && <ListaHe hes={time.realizadas} vazio="Nenhuma HE realizada" />}
      {aba === 'falta' && <ListaHe hes={time.faltaHe} vazio="Nenhuma Falta HE registrada" faltaHe />}
      {aba === 'compensacoes' && <ListaCompensacoes comps={time.compensacoesPendentes} />}

      {modalAberto && <ModalLancarHe membros={membros} onClose={() => setModalAberto(false)} />}
      {modalComp && <ModalLancarCompensacao membros={membros} onClose={() => setModalComp(false)} />}
    </div>
  )
}

function ModalLancarCompensacao({ membros, onClose }: { membros: Membro[]; onClose: () => void }) {
  const router = useRouter()
  const [colaboradorId, setColaboradorId] = useState('')
  const [dataFalta, setDataFalta] = useState('')
  const [motivo, setMotivo] = useState('')
  const [info, setInfo] = useState<{ eh_dia_escala: boolean; minutos: number; max_min_dia: number; dias_semana: number[]; hora_inicio: string | null; hora_fim: string | null } | null>(null)
  const [slots, setSlots] = useState<{ data: string; hora_inicio: string; hora_fim: string }[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const limite = info?.max_min_dia ?? 120
  const alvo = info?.eh_dia_escala ? info.minutos : 0

  // Busca a jornada do colaborador na data da falta e abre os slots
  useEffect(() => {
    if (!colaboradorId || !dataFalta) { setInfo(null); setSlots([]); return }
    let ativo = true
    getJornadaColaboradorAction(colaboradorId, dataFalta).then((r) => {
      if (!ativo) return
      if (!r.ok || !r.info.eh_dia_escala || r.info.minutos <= 0) { setInfo(r.ok ? r.info : null); setSlots([]); return }
      setInfo(r.info)
      const n = Math.max(1, Math.ceil(r.info.minutos / r.info.max_min_dia))
      const fim = cAddMin('18:00', r.info.max_min_dia)
      setSlots(Array.from({ length: n }, () => ({ data: '', hora_inicio: '18:00', hora_fim: fim })))
    })
    return () => { ativo = false }
  }, [colaboradorId, dataFalta])

  function setSlot(i: number, campo: 'data' | 'hora_inicio' | 'hora_fim', v: string) {
    setSlots((s) => s.map((d, idx) => (idx === i ? { ...d, [campo]: v } : d)))
  }
  function erroSlot(d: { data: string; hora_inicio: string; hora_fim: string }): string | null {
    if (!d.data) return null
    const dur = cDur(d.hora_inicio, d.hora_fim)
    if (dur <= 0) return 'Horário inválido'
    const escala = info ? (info.dias_semana ?? []).includes(cWeekday(d.data)) : false
    if (escala && dur > limite) return `Máx ${cFmt(limite)} em dia de escala`
    if (escala && info?.hora_inicio && info?.hora_fim) {
      const si = cToMin(d.hora_inicio), sf = cToMin(d.hora_fim)
      const ji = cToMin(info.hora_inicio), jf = cToMin(info.hora_fim)
      if (si < jf && ji < sf) return 'Mesmo turno da jornada'
    }
    return null
  }

  const preenchidos = slots.filter((s) => s.data)
  const total = preenchidos.reduce((acc, s) => acc + cDur(s.hora_inicio, s.hora_fim), 0)
  const faltam = Math.max(0, alvo - total)
  const temErro = slots.some((s) => erroSlot(s) !== null)
  const cobre = alvo > 0 && total >= alvo && !temErro

  function enviar() {
    setErro(null)
    if (!colaboradorId) { setErro('Selecione o colaborador'); return }
    if (!dataFalta) { setErro('Informe a data da falta'); return }
    if (info && !info.eh_dia_escala) { setErro('A data da falta não é dia de trabalho na escala'); return }
    if (motivo.trim().length < 3) { setErro('Descreva o motivo'); return }
    if (preenchidos.length === 0) { setErro('Preencha os dias de compensação'); return }
    if (temErro) { setErro('Corrija os dias destacados'); return }
    if (!cobre) { setErro(`Os dias somam ${cFmt(total)}, mas a jornada a compensar é ${cFmt(alvo)}. Faltam ${cFmt(faltam)}.`); return }
    startTransition(async () => {
      const r = await criarCompensacaoGestorAction({ colaborador_id: colaboradorId, data_falta: dataFalta, motivo: motivo.trim(), dias: preenchidos })
      if (!r.ok) { setErro(r.error); return }
      onClose()
      router.refresh()
    })
  }

  return createPortal(
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg my-8">
        <Card>
          <CardContent className="p-0">
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-2">
                <CalendarClock className="h-5 w-5 text-blue-600" />
                <p className="font-semibold text-gray-900">Lançar Compensação de Falta</p>
              </div>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700">Colaborador</label>
                  <select value={colaboradorId} onChange={(e) => setColaboradorId(e.target.value)}
                    className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm">
                    <option value="">Selecione…</option>
                    {membros.map((m) => <option key={m.id} value={m.id}>{m.nome_completo}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700">Data da falta</label>
                  <Input type="date" value={dataFalta} onChange={(e) => setDataFalta(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700">Motivo</label>
                <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex: Consulta médica" />
              </div>

              {info && !info.eh_dia_escala && (
                <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-700">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  Essa data não é dia de trabalho na escala — não há jornada a compensar.
                </div>
              )}

              {info && info.eh_dia_escala && (
                <>
                  <div className={`rounded-md border p-2.5 text-sm ${cobre ? 'border-green-200 bg-green-50' : 'border-blue-200 bg-blue-50'}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Jornada a compensar</span>
                      <span className="font-semibold text-gray-900">{cFmt(alvo)}</span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-gray-600">Distribuído nos dias</span>
                      <span className={`font-semibold ${cobre ? 'text-green-700' : 'text-blue-700'}`}>{cFmt(total)}</span>
                    </div>
                    {cobre
                      ? <p className="mt-1.5 text-xs text-green-700 flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Cobertura completa</p>
                      : <p className="mt-1.5 text-xs text-blue-700">Faltam <b>{cFmt(faltam)}</b>{faltam > 0 ? ` — cerca de ${Math.ceil(faltam / limite)} dia(s) de ${cFmt(limite)}` : ''}.</p>}
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-gray-700">
                      Dias de compensação · máx {cFmt(limite)}/dia em dias de escala
                    </label>
                    {slots.map((d, i) => {
                      const e = erroSlot(d)
                      return (
                        <div key={i} className="space-y-0.5">
                          <div className="flex items-end gap-2">
                            <span className="text-xs text-gray-400 pb-2 w-4">{i + 1}.</span>
                            <div className="flex-1">
                              <Input type="date" value={d.data} onChange={(ev) => setSlot(i, 'data', ev.target.value)} className={e ? 'border-red-400' : ''} />
                            </div>
                            <Input type="time" value={d.hora_inicio} onChange={(ev) => setSlot(i, 'hora_inicio', ev.target.value)} className="w-24" />
                            <Input type="time" value={d.hora_fim} onChange={(ev) => setSlot(i, 'hora_fim', ev.target.value)} className="w-24" />
                            <span className="text-xs text-gray-400 font-mono pb-2 w-10 text-right">{cFmt(cDur(d.hora_inicio, d.hora_fim))}</span>
                            {slots.length > 1 && (
                              <button onClick={() => setSlots((s) => s.filter((_, idx) => idx !== i))} className="text-gray-400 hover:text-red-500 pb-2"><Trash2 className="h-4 w-4" /></button>
                            )}
                          </div>
                          {e && <p className="text-xs text-red-600 pl-6">{e}</p>}
                        </div>
                      )
                    })}
                    <button onClick={() => setSlots((s) => [...s, { data: '', hora_inicio: '18:00', hora_fim: cAddMin('18:00', limite) }])}
                      className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800">
                      <Plus className="h-3 w-3" /> Adicionar dia
                    </button>
                  </div>
                </>
              )}

              <p className="text-xs text-gray-400">
                Criada já aprovada — os dias viram pontos de compensação que o colaborador marca. Concilia na data da falta.
              </p>
              {erro && <p className="text-sm text-red-600">{erro}</p>}
              <div className="flex gap-2 pt-1">
                <Button variant="outline" onClick={onClose} disabled={pending} className="flex-1">Cancelar</Button>
                <Button onClick={enviar} disabled={pending || !cobre} className="flex-1">
                  {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Criar compensação
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>,
    document.body,
  )
}

function ListaHe({ hes, vazio, faltaHe, editavel }: { hes: HeView[]; vazio: string; faltaHe?: boolean; editavel?: boolean }) {
  if (hes.length === 0) {
    return (
      <Card><CardContent className="py-10 flex flex-col items-center text-gray-400 text-sm">
        <Clock className="h-10 w-10 mb-2 opacity-40" />{vazio}
      </CardContent></Card>
    )
  }
  return (
    <Card>
      <CardContent className="p-0">
        {faltaHe && (
          <div className="px-3 py-2 text-xs text-gray-500 border-b bg-gray-50">
            Registro de controle — não gera desconto nem alerta ao colaborador.
          </div>
        )}
        <table className="w-full text-sm">
          <thead className="text-xs text-gray-500 uppercase">
            <tr className="border-b bg-gray-50">
              <th className="text-left px-3 py-2 font-medium">Colaborador</th>
              <th className="text-left px-3 py-2 font-medium">Data</th>
              <th className="text-left px-3 py-2 font-medium">Horário</th>
              <th className="text-right px-3 py-2 font-medium">Tipo</th>
              {editavel && <th className="text-right px-3 py-2 font-medium">Ações</th>}
            </tr>
          </thead>
          <tbody>
            {hes.map((h) => <HeRow key={h.id} h={h} editavel={!!editavel && !h.compensacao_id} />)}
          </tbody>
        </table>
      </CardContent>
    </Card>
  )
}

function HeRow({ h, editavel }: { h: HeView; editavel: boolean }) {
  const router = useRouter()
  const [ajustar, setAjustar] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const t = TIPO_BADGE[h.tipo] ?? { label: h.tipo, variant: 'secondary' as const }

  function cancelar() {
    if (!confirm('Cancelar esta HE? O colaborador não poderá mais marcá-la.')) return
    startTransition(async () => {
      const r = await cancelarHeAction(h.id)
      if (!r.ok) { setErro(r.error); return }
      router.refresh()
    })
  }

  return (
    <>
      <tr className="border-b last:border-0">
        <td className="px-3 py-2.5">
          <p className="font-medium text-gray-900">{h.colaborador.nome_completo}</p>
          <p className="text-xs text-gray-400 font-mono">{h.colaborador.matricula}</p>
          {erro && <p className="text-xs text-red-600">{erro}</p>}
        </td>
        <td className="px-3 py-2.5 font-mono text-xs">{fmtDataCurta(h.data)}</td>
        <td className="px-3 py-2.5 font-mono text-xs">{h.hora_inicio}–{h.hora_fim}</td>
        <td className="px-3 py-2.5 text-right">
          <Badge variant={t.variant}>{t.label}</Badge>
          {h.compensacao_id && <Badge variant="secondary" className="ml-1">Compensação</Badge>}
        </td>
        {editavel && (
          <td className="px-3 py-2.5 text-right whitespace-nowrap">
            <button onClick={() => setAjustar(true)} disabled={pending}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium mr-3">Ajustar</button>
            <button onClick={cancelar} disabled={pending}
              className="text-xs text-red-600 hover:text-red-800 font-medium">
              {pending ? '…' : 'Cancelar'}
            </button>
          </td>
        )}
      </tr>
      {ajustar && createPortal(<ModalAjustarHe h={h} onClose={() => setAjustar(false)} />, document.body)}
    </>
  )
}

function ModalAjustarHe({ h, onClose }: { h: HeView; onClose: () => void }) {
  const router = useRouter()
  const [data, setData] = useState(h.data)
  const [horaInicio, setHoraInicio] = useState(h.hora_inicio)
  const [horaFim, setHoraFim] = useState(h.hora_fim)
  const [erro, setErro] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function salvar() {
    setErro(null)
    startTransition(async () => {
      const r = await ajustarHeAction(h.id, { data, hora_inicio: horaInicio, hora_fim: horaFim })
      if (!r.ok) { setErro(r.error); return }
      onClose()
      router.refresh()
    })
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md">
        <Card>
          <CardContent className="p-0">
            <div className="flex items-center justify-between p-4 border-b">
              <p className="font-semibold text-gray-900">Ajustar HE — {h.colaborador.nome_completo}</p>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-4 space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700">Data</label>
                <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700">Início</label>
                  <Input type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700">Fim</label>
                  <Input type="time" value={horaFim} onChange={(e) => setHoraFim(e.target.value)} />
                </div>
              </div>
              <p className="text-xs text-amber-600">
                Alterar o horário exige que o colaborador aceite novamente antes de marcar.
              </p>
              {erro && <p className="text-sm text-red-600">{erro}</p>}
              <div className="flex gap-2 pt-1">
                <Button variant="outline" onClick={onClose} disabled={pending} className="flex-1">Cancelar</Button>
                <Button onClick={salvar} disabled={pending} className="flex-1">
                  {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Salvar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function ListaCompensacoes({ comps }: { comps: CompPendente[] }) {
  if (comps.length === 0) {
    return (
      <Card><CardContent className="py-10 flex flex-col items-center text-gray-400 text-sm">
        <CheckCircle2 className="h-10 w-10 mb-2 opacity-40" />Nenhuma compensação pendente
      </CardContent></Card>
    )
  }
  return <div className="space-y-3">{comps.map((c) => <CompCard key={c.id} comp={c} />)}</div>
}

function CompCard({ comp }: { comp: CompPendente }) {
  const router = useRouter()
  const [obs, setObs] = useState('')
  const [modoReprovar, setModoReprovar] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function aprovar() {
    startTransition(async () => {
      const r = await aprovarCompensacaoAction(comp.id)
      if (!r.ok) { setErro(r.error); return }
      router.refresh()
    })
  }
  function reprovar() {
    if (obs.trim().length < 3) { setErro('Descreva o motivo'); return }
    startTransition(async () => {
      const r = await reprovarCompensacaoAction(comp.id, obs.trim())
      if (!r.ok) { setErro(r.error); return }
      router.refresh()
    })
  }

  const totalMin = comp.dias.reduce((acc, d) => {
    const [hi, mi] = d.hora_inicio.split(':').map(Number)
    const [hf, mf] = d.hora_fim.split(':').map(Number)
    return acc + ((hf! * 60 + mf!) - (hi! * 60 + mi!))
  }, 0)

  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-start justify-between flex-wrap gap-2">
          <div>
            <p className="font-medium text-gray-900">{comp.colaborador.nome_completo}</p>
            <p className="text-xs text-gray-400 font-mono">{comp.colaborador.matricula}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">Falta a compensar</p>
            <p className="font-mono text-sm text-gray-800">{fmtDataCurta(comp.data_falta)}</p>
          </div>
        </div>
        <p className="text-sm text-gray-500 italic">"{comp.motivo}"</p>
        <div className="rounded-md border bg-gray-50 p-2 space-y-1">
          <p className="text-xs font-medium text-gray-600">
            Dias propostos ({Math.floor(totalMin / 60)}h{totalMin % 60 ? String(totalMin % 60).padStart(2, '0') : ''})
          </p>
          {comp.dias.map((d, i) => (
            <div key={i} className="flex items-center gap-2 text-xs font-mono text-gray-700">
              <Calendar className="h-3 w-3 text-gray-400" />
              {fmtDataCurta(d.data)} · {d.hora_inicio}–{d.hora_fim}
            </div>
          ))}
        </div>
        {erro && <p className="text-sm text-red-600">{erro}</p>}
        {!modoReprovar ? (
          <div className="flex gap-2">
            <Button size="sm" onClick={aprovar} disabled={pending}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Aprovar
            </Button>
            <Button size="sm" variant="destructive" onClick={() => setModoReprovar(true)} disabled={pending}>
              <XCircle className="h-4 w-4" /> Reprovar
            </Button>
          </div>
        ) : (
          <div className="space-y-2 p-3 bg-gray-50 rounded-md">
            <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2}
              className="w-full rounded-md border px-3 py-2 text-sm" placeholder="Motivo da reprovação" />
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => { setModoReprovar(false); setObs('') }}>Cancelar</Button>
              <Button size="sm" variant="destructive" onClick={reprovar} disabled={pending}>
                {pending && <Loader2 className="h-4 w-4 animate-spin" />} Confirmar reprovação
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ModalLancarHe({ membros, onClose }: { membros: Membro[]; onClose: () => void }) {
  const router = useRouter()
  const [colaboradorId, setColaboradorId] = useState('')
  const [data, setData] = useState('')
  const [horaInicio, setHoraInicio] = useState('18:00')
  const [horaFim, setHoraFim] = useState('20:00')
  const [tipo, setTipo] = useState<'REMUNERADA' | 'COMPENSACAO'>('REMUNERADA')
  const [motivo, setMotivo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function enviar() {
    setErro(null)
    if (!colaboradorId) { setErro('Selecione o colaborador'); return }
    if (!data) { setErro('Informe a data'); return }
    startTransition(async () => {
      const r = await lancarHeAction({
        colaborador_id: colaboradorId, data, hora_inicio: horaInicio, hora_fim: horaFim, tipo,
        ...(motivo.trim() ? { motivo: motivo.trim() } : {}),
      })
      if (!r.ok) { setErro(r.error); return }
      onClose()
      router.refresh()
    })
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md">
        <Card>
          <CardContent className="p-0">
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-blue-600" />
                <p className="font-semibold text-gray-900">Lançar Hora Extra</p>
              </div>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-4 space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700">Colaborador</label>
                <select value={colaboradorId} onChange={(e) => setColaboradorId(e.target.value)}
                  className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm">
                  <option value="">Selecione…</option>
                  {membros.map((m) => <option key={m.id} value={m.id}>{m.nome_completo} ({m.matricula})</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700">Data</label>
                <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700">Início</label>
                  <Input type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700">Fim</label>
                  <Input type="time" value={horaFim} onChange={(e) => setHoraFim(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700">Destino</label>
                <select value={tipo} onChange={(e) => setTipo(e.target.value as 'REMUNERADA' | 'COMPENSACAO')}
                  className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm">
                  <option value="REMUNERADA">Remunerada (folha)</option>
                  <option value="COMPENSACAO">Banco de horas</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700">Motivo (opcional)</label>
                <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex: Demanda de campanha" />
              </div>
              <p className="text-xs text-gray-400">
                A HE deve ser em turno diferente da jornada. O colaborador precisa aceitar antes de marcar.
              </p>
              {erro && <p className="text-sm text-red-600">{erro}</p>}
              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={onClose} disabled={pending} className="flex-1">Cancelar</Button>
                <Button onClick={enviar} disabled={pending} className="flex-1">
                  {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Lançar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap ${
        active ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'
      }`}>
      {children}
    </button>
  )
}

function Stat({ label, valor, color }: { label: string; valor: number; color: string }) {
  return (
    <Card><CardContent className="py-3 px-3 space-y-0.5">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-xl font-bold ${color}`}>{valor}</p>
    </CardContent></Card>
  )
}
