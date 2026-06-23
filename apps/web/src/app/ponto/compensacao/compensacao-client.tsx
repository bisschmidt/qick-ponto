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

interface AlvoJornada { eh_dia_escala: boolean; minutos: number; max_min_dia: number }

function FormCompensacao() {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [dataFalta, setDataFalta] = useState('')
  const [motivo, setMotivo] = useState('')
  const [dias, setDias] = useState<DiaForm[]>([{ data: '', hora_inicio: '18:00', hora_fim: '20:00' }])
  const [alvo, setAlvo] = useState<AlvoJornada | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  // Busca a jornada a compensar quando a data da falta muda
  useEffect(() => {
    if (!dataFalta) { setAlvo(null); return }
    let ativo = true
    getJornadaDoDiaAction(dataFalta).then((r) => {
      if (!ativo) return
      setAlvo(r.ok ? { eh_dia_escala: r.info.eh_dia_escala, minutos: r.info.minutos, max_min_dia: r.info.max_min_dia } : null)
    })
    return () => { ativo = false }
  }, [dataFalta])

  const totalPlanejado = dias.reduce((acc, d) => acc + minutosDe(d.hora_inicio, d.hora_fim), 0)
  const exigido = alvo?.minutos ?? 0
  const faltam = Math.max(0, exigido - totalPlanejado)
  const cobre = exigido > 0 && totalPlanejado >= exigido

  function setDia(i: number, campo: keyof DiaForm, valor: string) {
    setDias((ds) => ds.map((d, idx) => (idx === i ? { ...d, [campo]: valor } : d)))
  }
  function addDia() { setDias((ds) => [...ds, { data: '', hora_inicio: '18:00', hora_fim: '20:00' }]) }
  function rmDia(i: number) { setDias((ds) => ds.filter((_, idx) => idx !== i)) }

  function enviar() {
    setErro(null)
    if (!dataFalta) { setErro('Informe a data da falta'); return }
    if (alvo && !alvo.eh_dia_escala) { setErro('A data da falta não é um dia de trabalho na sua escala'); return }
    if (motivo.trim().length < 3) { setErro('Descreva o motivo'); return }
    if (dias.some((d) => !d.data)) { setErro('Preencha a data de todos os dias'); return }
    if (exigido > 0 && !cobre) { setErro(`Os dias somam ${fmtMin(totalPlanejado)}, mas você precisa compensar ${fmtMin(exigido)}. Faltam ${fmtMin(faltam)}.`); return }
    startTransition(async () => {
      const r = await solicitarCompensacaoAction({ data_falta: dataFalta, motivo: motivo.trim(), dias })
      if (!r.ok) { setErro(r.error); return }
      setAberto(false)
      setDataFalta(''); setMotivo(''); setDias([{ data: '', hora_inicio: '18:00', hora_fim: '20:00' }])
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
          <p className="font-semibold text-gray-900">Solicitar compensação</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-700">Data da falta</label>
            <Input type="date" value={dataFalta} onChange={(e) => setDataFalta(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-700">Motivo</label>
            <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex: Consulta médica" />
          </div>
        </div>

        {/* Alvo: jornada a compensar */}
        {alvo && !alvo.eh_dia_escala && (
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-700">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            Essa data não é um dia de trabalho na sua escala — não há jornada a compensar.
          </div>
        )}
        {alvo && alvo.eh_dia_escala && (
          <div className={`rounded-md border p-2.5 text-sm ${cobre ? 'border-green-200 bg-green-50' : 'border-blue-200 bg-blue-50'}`}>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Jornada a compensar</span>
              <span className="font-semibold text-gray-900">{fmtMin(exigido)}</span>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-gray-600">Planejado nos dias abaixo</span>
              <span className={`font-semibold ${cobre ? 'text-green-700' : 'text-blue-700'}`}>{fmtMin(totalPlanejado)}</span>
            </div>
            {!cobre && (
              <p className="mt-1.5 text-xs text-blue-700">
                Faltam <b>{fmtMin(faltam)}</b>. Máx {fmtMin(alvo.max_min_dia)} por dia de escala — adicione mais dias.
              </p>
            )}
            {cobre && <p className="mt-1.5 text-xs text-green-700">Cobertura completa da jornada ✓</p>}
          </div>
        )}

        <div className="space-y-2">
          <label className="text-xs font-medium text-gray-700">Dias para compensar</label>
          {dias.map((d, i) => {
            const m = minutosDe(d.hora_inicio, d.hora_fim)
            return (
              <div key={i} className="flex items-end gap-2">
                <div className="flex-1 space-y-1">
                  <Input type="date" value={d.data} onChange={(e) => setDia(i, 'data', e.target.value)} />
                </div>
                <Input type="time" value={d.hora_inicio} onChange={(e) => setDia(i, 'hora_inicio', e.target.value)} className="w-24" />
                <Input type="time" value={d.hora_fim} onChange={(e) => setDia(i, 'hora_fim', e.target.value)} className="w-24" />
                <span className="text-xs text-gray-400 font-mono pb-2 w-10 text-right">{fmtMin(m)}</span>
                {dias.length > 1 && (
                  <button onClick={() => rmDia(i)} className="text-gray-400 hover:text-red-500 pb-2"><Trash2 className="h-4 w-4" /></button>
                )}
              </div>
            )
          })}
          <button onClick={addDia} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800">
            <Plus className="h-3 w-3" /> Adicionar dia
          </button>
        </div>

        <p className="text-xs text-gray-400">
          Em dias fora da sua escala (ex.: sábado) é possível trabalhar mais. A solicitação vai para
          aprovação do líder.
        </p>
        {erro && <p className="text-sm text-red-600">{erro}</p>}
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setAberto(false)} disabled={pending} className="flex-1">Cancelar</Button>
          <Button onClick={enviar} disabled={pending || (exigido > 0 && !cobre) || (!!alvo && !alvo.eh_dia_escala)} className="flex-1">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Enviar solicitação
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
