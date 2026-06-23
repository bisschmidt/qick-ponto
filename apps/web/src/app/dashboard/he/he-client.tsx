'use client'

import { useState, useTransition } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Clock, Plus, X, Loader2, CheckCircle2, XCircle, Calendar, TrendingUp } from 'lucide-react'
import { fmtDataCurta } from '@/lib/utils'
import {
  lancarHeAction,
  ajustarHeAction,
  cancelarHeAction,
  aprovarCompensacaoAction,
  reprovarCompensacaoAction,
} from './actions'

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
        <Button onClick={() => setModalAberto(true)}>
          <Plus className="h-4 w-4" /> Lançar HE
        </Button>
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
    </div>
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
                  <option value="COMPENSACAO">Compensação (banco de horas)</option>
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
