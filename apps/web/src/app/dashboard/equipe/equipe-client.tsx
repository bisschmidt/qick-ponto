'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Users, AlertTriangle, Clock, CheckCircle2, XCircle, MessageSquare, Loader2, FileText, Edit3, TriangleAlert } from 'lucide-react'
import { fmtMinutos, fmtDataCurta } from '@/lib/utils'

const TIPO_LABEL: Record<string, string> = {
  ENTRADA: 'Entrada',
  SAIDA: 'Saída',
  SAIDA_PAUSA_NR17: 'Saída pausa NR-17',
  RETORNO_PAUSA_NR17: 'Retorno pausa NR-17',
  SAIDA_INTERVALO: 'Saída de intervalo',
  RETORNO_INTERVALO: 'Retorno de intervalo',
}

function horaDeIso(iso: string): string {
  const d = new Date(iso)
  const brt = new Date(d.getTime() - 3 * 3600 * 1000)
  return `${String(brt.getUTCHours()).padStart(2, '0')}:${String(brt.getUTCMinutes()).padStart(2, '0')}`
}
import { aprovarComoGestorAction, reprovarComoGestorAction, aprovarComoRhAction, pedirComprovacaoAction } from './actions'

interface MembroTime {
  colaborador_id: string
  nome: string
  matricula: string
  marcacoes_dia: number
  status: string
  minutos_trabalhados: number
  minutos_he50: number
  minutos_atraso: number
  inconsistencias: string[]
  ajuste: { id: string; status: string; motivo: string } | null
}

interface AlertaEquipe {
  colaborador_id: string
  nome: string
  matricula: string
  faltas_consecutivas: number
  alerta: string | null
}

interface Pendencia {
  id: string
  status: string
  tipo_ajuste: string
  motivo: { descricao: string }
  colaborador: { id: string; nome_completo: string; matricula: string }
  data_ponto: string
  justificativa: string
  created_at: string
  novo_timestamp: string | null
  novo_tipo: string | null
}

type Aba = 'dia' | 'pendencias' | 'alertas'

const STATUS_VIS: Record<string, { label: string; variant: 'success' | 'warning' | 'destructive' | 'secondary' }> = {
  OK:               { label: 'Presença',           variant: 'success' },
  PRESENTE:         { label: 'Presença',           variant: 'success' },
  INCOMPLETO:       { label: 'Incompleto',         variant: 'warning' },
  PONTO_SEM_SAIDA:  { label: 'Sem Saída',          variant: 'warning' },
  SAIDA_ANTECIPADA: { label: 'Saída Antecipada',   variant: 'secondary' },
  FALTA:            { label: 'Falta Injustificada', variant: 'destructive' },
  ATESTADO:         { label: 'Atestado',            variant: 'secondary' },
  FERIADO:          { label: 'Feriado',             variant: 'secondary' },
  DSR:              { label: 'DSR',                 variant: 'secondary' },
  FERIAS:           { label: 'Férias',              variant: 'secondary' },
  FOLGA:            { label: 'Folga',               variant: 'secondary' },
  DESLIGADO:        { label: 'Desligado',           variant: 'secondary' },
  AFASTAMENTO_INSS:       { label: 'Afastado', variant: 'secondary' },
  SUSPENSAO:              { label: 'Afastado', variant: 'secondary' },
  LICENCA_MATERNIDADE:    { label: 'Afastado', variant: 'secondary' },
  LICENCA_PATERNIDADE:    { label: 'Afastado', variant: 'secondary' },
  LICENCA_NAO_REMUNERADA: { label: 'Afastado', variant: 'secondary' },
  LICENCA_OUTRAS:         { label: 'Afastado', variant: 'secondary' },
  HE:          { label: 'Hora Extra',  variant: 'success' },
  COMPENSADO:  { label: 'Compensado',  variant: 'secondary' },
  A_COMPENSAR: { label: 'A Compensar', variant: 'warning' },
}

const ALERTA_VIS: Record<string, { label: string; variant: 'warning' | 'destructive' }> = {
  FALTA_INJUSTIFICADA: { label: 'Falta Injustificada', variant: 'warning' },
  FALTA_CONCENTRADA:   { label: 'Falta Concentrada',   variant: 'destructive' },
  POSSIVEL_ABANDONO:   { label: 'Possível Abandono',   variant: 'destructive' },
}

const STATUS_AJUSTE: Record<string, { label: string; variant: 'success' | 'warning' | 'destructive' | 'secondary' }> = {
  PENDENTE_GESTOR:  { label: 'Aguardando você', variant: 'warning' },
  PENDENTE_RH:      { label: 'Aguardando RH',   variant: 'warning' },
  APROVADO_RH:      { label: 'Aprovado',        variant: 'success' },
  APROVADO_GESTOR:  { label: 'Aprovado gestor', variant: 'success' },
  REPROVADO_GESTOR: { label: 'Reprovado',       variant: 'destructive' },
  REPROVADO_RH:     { label: 'Reprovado',       variant: 'destructive' },
}

export function EquipeClient({
  data, timeDia, pendencias, alertas, role,
}: {
  data: string
  timeDia: MembroTime[]
  pendencias: Pendencia[]
  alertas: AlertaEquipe[]
  role: string
}) {
  const router = useRouter()
  const [aba, setAba] = useState<Aba>('dia')
  const [filtroStatus, setFiltroStatus] = useState<string>('')
  const [filtroNome, setFiltroNome] = useState<string>('')

  const podeRH = role === 'ADMIN_TENANT' || role === 'RH_DP'

  const filtrado = timeDia.filter((m) => {
    if (filtroStatus && m.status !== filtroStatus) return false
    if (filtroNome && !m.nome.toLowerCase().includes(filtroNome.toLowerCase())) return false
    return true
  })

  const totaisTime = {
    presentes:  timeDia.filter((m) => m.status === 'OK').length,
    incomp:     timeDia.filter((m) => m.status === 'INCOMPLETO' || m.status === 'PONTO_SEM_SAIDA').length,
    faltas:     timeDia.filter((m) => m.status === 'FALTA').length,
    pendencias: pendencias.length,
  }
  const alertasAtivos = alertas.filter((a) => a.alerta !== null)
  const alertaMap = new Map(alertas.map((a) => [a.colaborador_id, a]))

  function trocarData(novo: string) {
    router.push(`/dashboard/equipe?data=${novo}`)
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Minha equipe</h1>
        <p className="text-sm text-gray-500 mt-1">
          Visão do time + aprovações pendentes
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b flex-wrap">
        <TabBtn active={aba === 'dia'} onClick={() => setAba('dia')}>
          <Users className="h-4 w-4" /> Time no dia
        </TabBtn>
        <TabBtn active={aba === 'pendencias'} onClick={() => setAba('pendencias')}>
          <Clock className="h-4 w-4" />
          Pendências ({pendencias.length})
        </TabBtn>
        <TabBtn active={aba === 'alertas'} onClick={() => setAba('alertas')}>
          <TriangleAlert className="h-4 w-4" />
          Alertas {alertasAtivos.length > 0 && <span className="bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 ml-1">{alertasAtivos.length}</span>}
        </TabBtn>
      </div>

      {aba === 'dia' && (
        <>
          {/* Métricas rápidas */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Stat label="Presentes" valor={String(totaisTime.presentes)} color="text-green-600" />
            <Stat label="Incompletos" valor={String(totaisTime.incomp)}  color="text-amber-600" />
            <Stat label="Faltas"     valor={String(totaisTime.faltas)}  color="text-red-600" />
            <Stat label="Pendências" valor={String(totaisTime.pendencias)} color="text-blue-600" />
          </div>

          {/* Filtros */}
          <Card>
            <CardContent className="pt-4 flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <label className="text-xs text-gray-500">Data</label>
                <Input type="date" value={data} onChange={(e) => trocarData(e.target.value)} />
              </div>
              <div className="space-y-1 flex-1 min-w-[140px]">
                <label className="text-xs text-gray-500">Buscar colaborador</label>
                <Input value={filtroNome} onChange={(e) => setFiltroNome(e.target.value)} placeholder="nome..." />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-gray-500">Status</label>
                <select
                  value={filtroStatus}
                  onChange={(e) => setFiltroStatus(e.target.value)}
                  className="flex h-10 rounded-md border bg-background px-3 py-2 text-sm"
                >
                  <option value="">Todos</option>
                  <option value="OK">Presença</option>
                  <option value="INCOMPLETO">Incompleto</option>
                  <option value="PONTO_SEM_SAIDA">Sem Saída</option>
                  <option value="FALTA">Falta Injustificada</option>
                  <option value="ATESTADO">Atestado</option>
                  <option value="FERIAS">Férias</option>
                  <option value="FERIADO">Feriado</option>
                  <option value="DSR">DSR</option>
                  <option value="DESLIGADO">Desligado</option>
                  <option value="AFASTAMENTO_INSS">Afastado</option>
                </select>
              </div>
            </CardContent>
          </Card>

          {/* Lista do time */}
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="text-xs text-gray-500 uppercase">
                  <tr className="border-b bg-gray-50">
                    <th className="text-left px-3 py-2 font-medium">Colaborador</th>
                    <th className="text-left px-3 py-2 font-medium">Marcações</th>
                    <th className="text-right px-3 py-2 font-medium">Trab.</th>
                    <th className="text-right px-3 py-2 font-medium">HE</th>
                    <th className="text-right px-3 py-2 font-medium">Atraso</th>
                    <th className="text-right px-3 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtrado.length === 0 && (
                    <tr><td colSpan={6} className="text-center text-gray-400 py-8 text-sm">Nenhum membro encontrado</td></tr>
                  )}
                  {filtrado.map((m) => {
                    const s = STATUS_VIS[m.status] ?? { label: m.status, variant: 'secondary' as const }
                    const al = alertaMap.get(m.colaborador_id)
                    return (
                      <tr key={m.colaborador_id}
                          className="border-b last:border-0 hover:bg-blue-50 cursor-pointer"
                          onClick={() => router.push(`/dashboard/equipe/colaborador/${m.colaborador_id}?mes=${data.slice(0, 7)}`)}>
                        <td className="px-3 py-2.5">
                          <p className="font-medium text-gray-900">{m.nome}</p>
                          <div className="flex items-center gap-1 flex-wrap">
                            <p className="text-xs text-gray-400 font-mono">{m.matricula}</p>
                            {al?.alerta && (() => {
                              const av = ALERTA_VIS[al.alerta]
                              return av ? <Badge variant={av.variant} className="text-[10px] px-1 py-0">{av.label} ({al.faltas_consecutivas}d)</Badge> : null
                            })()}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 font-mono text-xs">{m.marcacoes_dia}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-xs">
                          {m.minutos_trabalhados > 0 ? fmtMinutos(m.minutos_trabalhados) : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-xs">
                          {m.minutos_he50 > 0 ? <span className="text-orange-600">{fmtMinutos(m.minutos_he50)}</span> : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-right font-mono text-xs">
                          {m.minutos_atraso > 0 ? <span className="text-amber-600">{fmtMinutos(m.minutos_atraso)}</span> : '—'}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <div className="flex justify-end gap-1 flex-wrap">
                            <Badge variant={s.variant}>{s.label}</Badge>
                            {m.ajuste && <Badge variant="secondary">{m.ajuste.motivo.slice(0, 10)}</Badge>}
                            {m.inconsistencias.length > 0 && <AlertTriangle className="h-4 w-4 text-amber-500" />}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}

      {aba === 'pendencias' && (
        <ListaPendencias pendencias={pendencias} podeRH={podeRH} />
      )}

      {aba === 'alertas' && (
        <ListaAlertas alertas={alertas} mes={data.slice(0, 7)} />
      )}
    </div>
  )
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
        active ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'
      }`}
    >
      {children}
    </button>
  )
}

function Stat({ label, valor, color }: { label: string; valor: string; color: string }) {
  return (
    <Card>
      <CardContent className="py-3 px-3 space-y-0.5">
        <p className="text-xs text-gray-500">{label}</p>
        <p className={`text-xl font-bold ${color}`}>{valor}</p>
      </CardContent>
    </Card>
  )
}

function ListaPendencias({ pendencias, podeRH }: { pendencias: Pendencia[]; podeRH: boolean }) {
  if (pendencias.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 flex flex-col items-center text-gray-400 text-sm">
          <CheckCircle2 className="h-10 w-10 mb-2 opacity-40" />
          Nenhuma pendência no momento
        </CardContent>
      </Card>
    )
  }

  // Agrupa por colaborador
  const grupos: Record<string, { colaborador: Pendencia['colaborador']; itens: Pendencia[] }> = {}
  for (const p of pendencias) {
    if (!grupos[p.colaborador.id]) grupos[p.colaborador.id] = { colaborador: p.colaborador, itens: [] }
    grupos[p.colaborador.id]!.itens.push(p)
  }

  return (
    <div className="space-y-4">
      {Object.values(grupos).map((g) => (
        <div key={g.colaborador.id} className="space-y-2">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-gray-800">{g.colaborador.nome_completo}</p>
            <span className="text-xs text-gray-400 font-mono">{g.colaborador.matricula}</span>
            <Badge variant="secondary">{g.itens.length} solicitação(ões)</Badge>
          </div>
          {g.itens.map((p) => (
            <PendenciaItem key={p.id} p={p} podeRH={podeRH} />
          ))}
        </div>
      ))}
    </div>
  )
}

function PendenciaItem({ p, podeRH }: { p: Pendencia; podeRH: boolean }) {
  const router = useRouter()
  const [obs, setObs] = useState('')
  const [abertoModal, setAbertoModal] = useState<'reprovar' | 'comprovacao' | null>(null)
  const [pending, startTransition] = useTransition()

  function aprovar() {
    startTransition(async () => {
      const action = p.status === 'PENDENTE_GESTOR'
        ? () => aprovarComoGestorAction(p.id, true) // gestor aprova e encaminha pra RH
        : podeRH
          ? () => aprovarComoRhAction(p.id)
          : null
      if (!action) return
      const r = await action()
      if (r.ok) router.refresh()
    })
  }
  function reprovar() {
    if (obs.trim().length < 3) return
    startTransition(async () => {
      await reprovarComoGestorAction(p.id, obs.trim())
      setAbertoModal(null)
      router.refresh()
    })
  }
  function pedirComp() {
    if (obs.trim().length < 3) return
    startTransition(async () => {
      await pedirComprovacaoAction(p.id, obs.trim())
      setAbertoModal(null)
      router.refresh()
    })
  }

  const s = STATUS_AJUSTE[p.status] ?? { label: p.status, variant: 'secondary' as const }

  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-start justify-between flex-wrap gap-2">
          <div className="space-y-1.5 min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              {p.tipo_ajuste === 'ATESTADO'
                ? <FileText className="h-4 w-4 text-green-600 shrink-0" />
                : <Edit3 className="h-4 w-4 text-blue-600 shrink-0" />
              }
              <Badge variant={s.variant}>{s.label}</Badge>
              <span className="text-xs text-gray-400 font-mono">{fmtDataCurta(p.data_ponto)}</span>
            </div>
            <p className="text-sm text-gray-700">
              <span className="font-medium">{p.motivo.descricao}</span>
            </p>
            {p.novo_tipo && p.novo_timestamp && (
              <p className="text-xs bg-blue-50 text-blue-800 rounded px-2 py-1 inline-block">
                Pedido: <strong>{TIPO_LABEL[p.novo_tipo] ?? p.novo_tipo}</strong> às <strong>{horaDeIso(p.novo_timestamp)}</strong>
              </p>
            )}
            <p className="text-sm text-gray-500 italic">"{p.justificativa}"</p>
          </div>
          <Link
            href={`/dashboard/equipe/colaborador/${p.colaborador.id}?mes=${p.data_ponto.slice(0, 7)}`}
            className="text-xs text-blue-600 hover:underline whitespace-nowrap"
          >
            Ver ficha →
          </Link>
        </div>

        {abertoModal === null && (
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" onClick={aprovar} disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              <CheckCircle2 className="h-4 w-4" /> Aprovar
            </Button>
            <Button size="sm" variant="outline" onClick={() => setAbertoModal('comprovacao')} disabled={pending}>
              <MessageSquare className="h-4 w-4" /> Pedir comprovação
            </Button>
            <Button size="sm" variant="destructive" onClick={() => setAbertoModal('reprovar')} disabled={pending}>
              <XCircle className="h-4 w-4" /> Reprovar
            </Button>
          </div>
        )}

        {abertoModal !== null && (
          <div className="space-y-2 p-3 bg-gray-50 rounded-md">
            <label className="text-xs font-medium text-gray-700">
              {abertoModal === 'reprovar' ? 'Motivo da reprovação' : 'O que você precisa?'}
            </label>
            <textarea
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              rows={2}
              className="w-full rounded-md border px-3 py-2 text-sm"
              placeholder={abertoModal === 'reprovar' ? 'Ex: Sem comprovação suficiente' : 'Ex: Anexar atestado'}
            />
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => { setAbertoModal(null); setObs('') }}>Cancelar</Button>
              <Button size="sm" onClick={abertoModal === 'reprovar' ? reprovar : pedirComp} disabled={pending}>
                {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                Enviar
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

const GRUPOS_ALERTA = [
  { key: 'POSSIVEL_ABANDONO',   label: 'Possível Abandono',  desc: '20 ou mais faltas consecutivas',  color: 'border-red-300 bg-red-50' },
  { key: 'FALTA_CONCENTRADA',   label: 'Falta Concentrada',  desc: '5 a 19 faltas consecutivas',       color: 'border-amber-300 bg-amber-50' },
  { key: 'FALTA_INJUSTIFICADA', label: 'Falta Injustificada', desc: '1 a 4 faltas consecutivas',       color: 'border-yellow-200 bg-yellow-50' },
]

function ListaAlertas({ alertas, mes }: { alertas: AlertaEquipe[]; mes: string }) {
  const router = useRouter()
  const comAlerta = alertas.filter((a) => a.alerta !== null)

  if (comAlerta.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 flex flex-col items-center text-gray-400 text-sm">
          <CheckCircle2 className="h-10 w-10 mb-2 opacity-40" />
          Nenhum alerta no momento
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {GRUPOS_ALERTA.map((g) => {
        const membros = alertas.filter((a) => a.alerta === g.key)
        if (membros.length === 0) return null
        return (
          <Card key={g.key} className={`border ${g.color}`}>
            <CardContent className="p-0">
              <div className="px-4 py-3 border-b flex items-center gap-2">
                <TriangleAlert className="h-4 w-4 text-amber-600" />
                <div>
                  <p className="font-semibold text-gray-800 text-sm">{g.label}</p>
                  <p className="text-xs text-gray-500">{g.desc} · {membros.length} colaborador(es)</p>
                </div>
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {membros.map((m) => (
                    <tr
                      key={m.colaborador_id}
                      className="border-b last:border-0 hover:bg-white/60 cursor-pointer transition-colors"
                      onClick={() => router.push(`/dashboard/equipe/colaborador/${m.colaborador_id}?mes=${mes}`)}
                    >
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-gray-900">{m.nome}</p>
                        <p className="text-xs text-gray-400 font-mono">{m.matricula}</p>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Badge variant={g.key === 'FALTA_INJUSTIFICADA' ? 'warning' : 'destructive'}>
                          {m.faltas_consecutivas} dia(s) consecutivos
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
