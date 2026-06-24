'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Clock, Plus, Trash2, Loader2, CheckCircle2, XCircle, CalendarDays, AlertTriangle } from 'lucide-react'
import { fmtDataCurta } from '@/lib/utils'
import { aceitarHeAction, recusarHeAction, solicitarCompensacaoAction, getJornadaDoDiaAction } from './actions'

function minutosDe(hi: string, hf: string): number {
  const [ai, bi] = hi.split(':').map(Number) as [number, number]
  const [af, bf] = hf.split(':').map(Number) as [number, number]
  return Math.max(0, (af * 60 + bf) - (ai * 60 + bi))
}
function fmtMin(min: number): string {
  const h = Math.floor(min / 60), m = min % 60
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`
}

interface MinhaHe {
  id: string
  data: string
  hora_inicio: string
  hora_fim: string
  tipo: string
  status: string
  motivo: string | null
  compensacao_id: string | null
}
interface MinhaCompensacao {
  id: string
  data_falta: string
  motivo: string
  status: string
  resultado: string | null
  hes: { data: string; hora_inicio: string; hora_fim: string; status: string }[]
}

const COMP_STATUS: Record<string, { label: string; variant: 'success' | 'warning' | 'destructive' | 'secondary' }> = {
  PENDENTE_GESTOR: { label: 'Aguardando líder', variant: 'warning' },
  APROVADA:        { label: 'Aprovada',          variant: 'success' },
  REPROVADA:       { label: 'Reprovada',         variant: 'destructive' },
  CANCELADA:       { label: 'Cancelada',         variant: 'secondary' },
}
const RESULTADO: Record<string, string> = {
  ABONADA_TOTAL: 'Falta abonada',
  PARCIAL: 'Compensada parcialmente',
  NAO_COMPENSADA: 'Não compensada',
}

export function CompensacaoClient({ hes, compensacoes }: { hes: MinhaHe[]; compensacoes: MinhaCompensacao[] }) {
  const pendentesAceite = hes.filter((h) => h.status === 'PENDENTE_ACEITE' && !h.compensacao_id)
  const aMarcar = hes.filter((h) => h.status === 'AGUARDANDO_MARCACAO')

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Horas Extras & Compensação</h1>
        <p className="text-sm text-gray-500 mt-1">Aceite HE planejadas e solicite compensação de faltas</p>
      </div>

      {pendentesAceite.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-700">Aguardando seu aceite</h2>
          {pendentesAceite.map((h) => <HeAceite key={h.id} he={h} />)}
        </section>
      )}

      {aMarcar.length > 0 && (
        <Card>
          <CardContent className="pt-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-2">HE aprovadas a marcar</h2>
            <div className="space-y-1.5">
              {aMarcar.map((h) => (
                <div key={h.id} className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 font-mono">{fmtDataCurta(h.data)} · {h.hora_inicio}–{h.hora_fim}</span>
                  <Badge variant="secondary">{h.tipo === 'COMPENSACAO' ? 'Compensação' : 'Remunerada'}</Badge>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-2">Use o botão "Bater Hora Extra" na tela de bater ponto no dia.</p>
          </CardContent>
        </Card>
      )}

      <FormCompensacao />

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-gray-700">Minhas compensações</h2>
        {compensacoes.length === 0 ? (
          <Card><CardContent className="py-8 flex flex-col items-center text-gray-400 text-sm">
            <CalendarDays className="h-9 w-9 mb-2 opacity-40" />Nenhuma compensação solicitada
          </CardContent></Card>
        ) : compensacoes.map((c) => <CompCard key={c.id} comp={c} />)}
      </section>
    </div>
  )
}

function HeAceite({ he }: { he: MinhaHe }) {
  const router = useRouter()
  const [erro, setErro] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function agir(fn: typeof aceitarHeAction) {
    startTransition(async () => {
      const r = await fn(he.id)
      if (!r.ok) { setErro(r.error); return }
      router.refresh()
    })
  }

  return (
    <Card>
      <CardContent className="pt-4 space-y-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <p className="font-mono text-sm text-gray-800">{fmtDataCurta(he.data)} · {he.hora_inicio}–{he.hora_fim}</p>
            <p className="text-xs text-gray-500">{he.tipo === 'COMPENSACAO' ? 'Compensação' : 'Remunerada (folha)'}{he.motivo ? ` · ${he.motivo}` : ''}</p>
          </div>
          <Badge variant="warning">Aguardando aceite</Badge>
        </div>
        {erro && <p className="text-sm text-red-600">{erro}</p>}
        <div className="flex gap-2">
          <Button size="sm" onClick={() => agir(aceitarHeAction)} disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Aceitar
          </Button>
          <Button size="sm" variant="destructive" onClick={() => agir(recusarHeAction)} disabled={pending}>
            <XCircle className="h-4 w-4" /> Recusar
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function CompCard({ comp }: { comp: MinhaCompensacao }) {
  const s = COMP_STATUS[comp.status] ?? { label: comp.status, variant: 'secondary' as const }
  return (
    <Card>
      <CardContent className="pt-4 space-y-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <p className="text-xs text-gray-500">Falta a compensar</p>
            <p className="font-mono text-sm text-gray-800">{fmtDataCurta(comp.data_falta)}</p>
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            <Badge variant={s.variant}>{s.label}</Badge>
            {comp.resultado && <Badge variant="secondary">{RESULTADO[comp.resultado] ?? comp.resultado}</Badge>}
          </div>
        </div>
        <p className="text-sm text-gray-500 italic">"{comp.motivo}"</p>
        <div className="space-y-1">
          {comp.hes.map((h, i) => (
            <div key={i} className="flex items-center justify-between text-xs font-mono text-gray-600">
              <span>{fmtDataCurta(h.data)} · {h.hora_inicio}–{h.hora_fim}</span>
              <span className={h.status === 'REALIZADA' ? 'text-green-600' : 'text-gray-400'}>
                {h.status === 'REALIZADA' ? 'feito' : h.status === 'FALTA_HE' ? 'não marcado' : 'a marcar'}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

interface DiaForm { data: string; hora_inicio: string; hora_fim: string }

interface InfoFalta {
  eh_dia_escala: boolean
  minutos: number        // jornada a compensar (alvo)
  max_min_dia: number    // limite de HE por dia de escala
  dias_semana: number[]
  hora_inicio: string | null
  hora_fim: string | null
}

function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number) as [number, number]
  return h * 60 + m
}
function addMin(hhmm: string, min: number): string {
  let t = (toMin(hhmm) + min) % 1440
  if (t < 0) t += 1440
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}
function weekdayOf(dateStr: string): number {
  return new Date(`${dateStr}T12:00:00Z`).getUTCDay()
}

function FormCompensacao() {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [dataFalta, setDataFalta] = useState('')
  const [motivo, setMotivo] = useState('')
  const [info, setInfo] = useState<InfoFalta | null>(null)
  const [slots, setSlots] = useState<DiaForm[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const limite = info?.max_min_dia ?? 120
  const alvo = info?.eh_dia_escala ? info.minutos : 0

  // Ao escolher a falta: busca a jornada e ABRE os slots automaticamente (jornada ÷ limite)
  useEffect(() => {
    if (!dataFalta) { setInfo(null); setSlots([]); return }
    let ativo = true
    getJornadaDoDiaAction(dataFalta).then((r) => {
      if (!ativo) return
      if (!r.ok || !r.info.eh_dia_escala || r.info.minutos <= 0) {
        setInfo(r.ok ? r.info : null); setSlots([]); return
      }
      setInfo(r.info)
      const n = Math.max(1, Math.ceil(r.info.minutos / r.info.max_min_dia))
      const fimPadrao = addMin('18:00', r.info.max_min_dia)
      setSlots(Array.from({ length: n }, () => ({ data: '', hora_inicio: '18:00', hora_fim: fimPadrao })))
    })
    return () => { ativo = false }
  }, [dataFalta])

  function setSlot(i: number, campo: keyof DiaForm, v: string) {
    setSlots((s) => s.map((d, idx) => (idx === i ? { ...d, [campo]: v } : d)))
  }
  function addSlot() { setSlots((s) => [...s, { data: '', hora_inicio: '18:00', hora_fim: addMin('18:00', limite) }]) }
  function rmSlot(i: number) { setSlots((s) => s.filter((_, idx) => idx !== i)) }

  // Validação por slot (só os que já têm data)
  function erroSlot(d: DiaForm): string | null {
    if (!d.data) return null
    const dur = minutosDe(d.hora_inicio, d.hora_fim)
    if (dur <= 0) return 'Horário inválido'
    const escala = info ? (info.dias_semana ?? []).includes(weekdayOf(d.data)) : false
    if (escala && dur > limite) return `Máx ${fmtMin(limite)} em dia de escala`
    if (escala && info?.hora_inicio && info?.hora_fim) {
      const si = toMin(d.hora_inicio), sf = toMin(d.hora_fim)
      const ji = toMin(info.hora_inicio), jf = toMin(info.hora_fim)
      if (si < jf && ji < sf) return 'Não pode ser no mesmo turno da jornada'
    }
    return null
  }

  const preenchidos = slots.filter((s) => s.data)
  const total = preenchidos.reduce((acc, s) => acc + Math.max(0, minutosDe(s.hora_inicio, s.hora_fim)), 0)
  const faltam = Math.max(0, alvo - total)
  const temErroSlot = slots.some((s) => erroSlot(s) !== null)
  const cobre = alvo > 0 && total >= alvo && !temErroSlot
  const sugeridos = faltam > 0 ? Math.ceil(faltam / limite) : 0

  function enviar() {
    setErro(null)
    if (!dataFalta) { setErro('Informe a data da falta'); return }
    if (info && !info.eh_dia_escala) { setErro('A data da falta não é um dia de trabalho na sua escala'); return }
    if (motivo.trim().length < 3) { setErro('Descreva o motivo'); return }
    if (preenchidos.length === 0) { setErro('Preencha os dias de compensação'); return }
    if (temErroSlot) { setErro('Corrija os dias destacados em vermelho'); return }
    if (!cobre) { setErro(`Os dias somam ${fmtMin(total)}, mas você precisa compensar ${fmtMin(alvo)}. Faltam ${fmtMin(faltam)}.`); return }
    startTransition(async () => {
      const r = await solicitarCompensacaoAction({ data_falta: dataFalta, motivo: motivo.trim(), dias: preenchidos })
      if (!r.ok) { setErro(r.error); return }
      setAberto(false)
      setDataFalta(''); setMotivo(''); setInfo(null); setSlots([])
      router.refresh()
    })
  }

  if (!aberto) {
    return (
      <Button variant="outline" onClick={() => setAberto(true)} className="w-full">
        <Plus className="h-4 w-4" /> Solicitar compensação de falta
      </Button>
    )
  }

  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-blue-600" />
          <p className="font-semibold text-gray-900">Solicitar compensação de falta</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-700">Data da falta a compensar</label>
            <Input type="date" value={dataFalta} onChange={(e) => setDataFalta(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-700">Motivo</label>
            <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex: Consulta médica" />
          </div>
        </div>

        {info && !info.eh_dia_escala && (
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-700">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            Essa data não é um dia de trabalho na sua escala — não há jornada a compensar.
          </div>
        )}

        {info && info.eh_dia_escala && (
          <>
            <div className={`rounded-md border p-2.5 text-sm ${cobre ? 'border-green-200 bg-green-50' : 'border-blue-200 bg-blue-50'}`}>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Jornada a compensar</span>
                <span className="font-semibold text-gray-900">{fmtMin(alvo)}</span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-gray-600">Distribuído nos dias</span>
                <span className={`font-semibold ${cobre ? 'text-green-700' : 'text-blue-700'}`}>{fmtMin(total)}</span>
              </div>
              {cobre ? (
                <p className="mt-1.5 text-xs text-green-700 flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Cobertura completa
                </p>
              ) : (
                <p className="mt-1.5 text-xs text-blue-700">
                  Faltam <b>{fmtMin(faltam)}</b>{sugeridos > 0 ? ` — cerca de ${sugeridos} dia(s) de ${fmtMin(limite)}` : ''}.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-700">
                Dias de compensação · máx {fmtMin(limite)}/dia em dias de escala (dias sem escala podem mais)
              </label>
              {slots.map((d, i) => {
                const e = erroSlot(d)
                const dur = Math.max(0, minutosDe(d.hora_inicio, d.hora_fim))
                return (
                  <div key={i} className="space-y-0.5">
                    <div className="flex items-end gap-2">
                      <span className="text-xs text-gray-400 pb-2 w-4">{i + 1}.</span>
                      <div className="flex-1">
                        <Input type="date" value={d.data} onChange={(ev) => setSlot(i, 'data', ev.target.value)} className={e ? 'border-red-400' : ''} />
                      </div>
                      <Input type="time" value={d.hora_inicio} onChange={(ev) => setSlot(i, 'hora_inicio', ev.target.value)} className="w-24" />
                      <Input type="time" value={d.hora_fim} onChange={(ev) => setSlot(i, 'hora_fim', ev.target.value)} className="w-24" />
                      <span className="text-xs text-gray-400 font-mono pb-2 w-10 text-right">{fmtMin(dur)}</span>
                      {slots.length > 1 && (
                        <button onClick={() => rmSlot(i)} className="text-gray-400 hover:text-red-500 pb-2"><Trash2 className="h-4 w-4" /></button>
                      )}
                    </div>
                    {e && <p className="text-xs text-red-600 pl-6">{e}</p>}
                  </div>
                )
              })}
              <button onClick={addSlot} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800">
                <Plus className="h-3 w-3" /> Adicionar dia
              </button>
            </div>
          </>
        )}

        <p className="text-xs text-gray-400">
          Cada dia deve ser em turno diferente da sua jornada. A solicitação vai para aprovação do líder.
        </p>
        {erro && <p className="text-sm text-red-600">{erro}</p>}
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setAberto(false)} disabled={pending} className="flex-1">Cancelar</Button>
          <Button onClick={enviar} disabled={pending || !cobre} className="flex-1">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Enviar solicitação
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
