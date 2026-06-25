'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, Save, AlertTriangle } from 'lucide-react'
import { atualizarJornadaAction } from './actions'
import { HorariosPorDiaEditor, type DiaHorario } from '../horarios-por-dia'

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

interface Pausa {
  nome: string
  ordem: number
  duracao_min: number
  eh_nr17: boolean
  eh_intervalo_refeicao: boolean
  computa_jornada: boolean
  janela_inicio_min: number | null
  janela_fim_min: number | null
}

interface Jornada {
  id: string
  nome: string
  tipo: string
  hora_inicio: string
  hora_fim: string
  dias_semana: number[]
  valida_feriado: boolean
  tolerancia_atraso_entrada: number
  tolerancia_atraso_intervalo: number
  tolerancia_antec_saida: number
  tolerancia_antec_inicio_interv: number
  janela_marcacao_min: number
  pausas: Pausa[]
  horarios?: DiaHorario[]
}

export function EditarJornadaForm({ jornada, userRole }: { jornada: Jornada; userRole: string }) {
  const router = useRouter()
  const podeEditar = userRole === 'ADMIN_TENANT'

  const [nome, setNome] = useState(jornada.nome)
  const [tipo, setTipo] = useState(jornada.tipo)
  const [horaInicio, setHoraInicio] = useState(jornada.hora_inicio)
  const [horaFim, setHoraFim] = useState(jornada.hora_fim)
  const [dias, setDias] = useState<number[]>(jornada.dias_semana)
  const [tolEntrada, setTolEntrada] = useState(jornada.tolerancia_atraso_entrada)
  const [tolInterv, setTolInterv]   = useState(jornada.tolerancia_atraso_intervalo)
  const [tolSaida, setTolSaida]     = useState(jornada.tolerancia_antec_saida)
  const [tolInicioInt, setTolInicioInt] = useState(jornada.tolerancia_antec_inicio_interv)
  const [janelaMarc, setJanelaMarc] = useState(jornada.janela_marcacao_min)
  const [pausas, setPausas]         = useState<Pausa[]>(jornada.pausas)
  const [horarios, setHorarios]     = useState<DiaHorario[]>(jornada.horarios ?? [])
  const [erro, setErro] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const ehNR17 = tipo === 'CALL_CENTER_NR17' || tipo === 'CALL_CENTER_COMP'

  function toggleDia(d: number) {
    if (!podeEditar) return
    setDias((cur) => cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d].sort())
  }

  function salvar() {
    setErro(null)
    if (nome.trim().length < 2) { setErro('Nome muito curto'); return }
    if (dias.length === 0) { setErro('Selecione ao menos um dia'); return }
    startTransition(async () => {
      const r = await atualizarJornadaAction(jornada.id, {
        nome: nome.trim(),
        tipo,
        hora_inicio: horaInicio,
        hora_fim: horaFim,
        dias_semana: dias,
        valida_feriado: jornada.valida_feriado,
        tolerancia_atraso_entrada: tolEntrada,
        tolerancia_atraso_intervalo: tolInterv,
        tolerancia_antec_saida: tolSaida,
        tolerancia_antec_inicio_interv: tolInicioInt,
        janela_marcacao_min: janelaMarc,
        pausas: pausas.map((p, i) => ({ ...p, ordem: i + 1 })),
        horarios: horarios.filter((h) => dias.includes(h.dia_semana)),
      })
      if (!r.ok) { setErro(r.error); return }
      router.push('/dashboard/jornadas')
    })
  }

  function solicitarAlteracao() {
    alert('Funcionalidade futura: enviar pedido de alteração ao admin via Ajustes. Por enquanto, fale com o admin do tenant.')
  }

  return (
    <div className="space-y-6">
      {!podeEditar && (
        <div className="rounded-md bg-amber-50 border border-amber-200 p-3 flex items-start gap-2 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 mt-0.5" />
          <div>
            Você não tem permissão para editar esta jornada. Apenas admins podem alterar.
            Use o botão abaixo para solicitar uma alteração.
          </div>
        </div>
      )}

      <Card>
        <CardContent className="pt-6 space-y-4">
          <h2 className="font-semibold text-gray-700">Dados da jornada</h2>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Nome</label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} disabled={!podeEditar} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Tipo</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)} disabled={!podeEditar}
              className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm">
              <option value="CALL_CENTER_NR17">Call Center NR-17 (6h)</option>
              <option value="CALL_CENTER_COMP">Call Center Compensação (6x1)</option>
              <option value="PADRAO_CLT">Padrão CLT (8h)</option>
              <option value="JORNADA_12_36">12×36</option>
              <option value="JORNADA_24_48">24×48</option>
              <option value="PERSONALIZADA">Personalizada</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Hora início</label>
              <Input type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} disabled={!podeEditar} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Hora fim</label>
              <Input type="time" value={horaFim} onChange={(e) => setHoraFim(e.target.value)} disabled={!podeEditar} />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Dias da semana</label>
            <div className="flex gap-2 flex-wrap">
              {DIAS.map((dia, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggleDia(i)}
                  disabled={!podeEditar}
                  className={`px-3 py-1.5 rounded-md text-sm border ${dias.includes(i) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600'} disabled:opacity-60`}
                >{dia}</button>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t">
            <HorariosPorDiaEditor
              dias={dias}
              base={{ inicio: horaInicio, fim: horaFim }}
              horarios={horarios}
              onChange={setHorarios}
              disabled={!podeEditar}
              ehNR17={ehNR17}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <h2 className="font-semibold text-gray-700">Tolerâncias (minutos)</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Field label="Atraso na entrada" value={tolEntrada} setValue={setTolEntrada} disabled={!podeEditar} />
            <Field label="Antecipação saída" value={tolSaida} setValue={setTolSaida} disabled={!podeEditar} />
            <Field label="Atraso intervalo" value={tolInterv} setValue={setTolInterv} disabled={!podeEditar} />
            <Field label="Antec. início interv." value={tolInicioInt} setValue={setTolInicioInt} disabled={!podeEditar} />
            <Field label="Janela marcação" value={janelaMarc} setValue={setJanelaMarc} disabled={!podeEditar} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 space-y-2">
          <h2 className="font-semibold text-gray-700">Pausas</h2>
          {pausas.length === 0 ? (
            <p className="text-sm text-gray-400">Sem pausas cadastradas</p>
          ) : (
            <div className="space-y-2">
              {pausas.map((p, i) => (
                <div key={i} className="flex items-center gap-2 flex-wrap border rounded-md px-3 py-2 text-sm">
                  <span className="font-mono text-xs text-gray-400">{i + 1}.</span>
                  <Input
                    value={p.nome}
                    onChange={(e) => setPausas((cur) => cur.map((x, k) => k === i ? { ...x, nome: e.target.value } : x))}
                    disabled={!podeEditar}
                    className="flex-1 min-w-[180px]"
                  />
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-500">min:</span>
                    <Input
                      type="number"
                      value={p.duracao_min}
                      onChange={(e) => setPausas((cur) => cur.map((x, k) => k === i ? { ...x, duracao_min: Number(e.target.value) } : x))}
                      disabled={!podeEditar}
                      className="w-20"
                    />
                  </div>
                  {p.eh_nr17 && <Badge variant="secondary">NR-17</Badge>}
                  {p.eh_intervalo_refeicao && <Badge variant="secondary">Refeição</Badge>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      <div className="flex gap-3">
        {podeEditar ? (
          <Button onClick={salvar} disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar alterações
          </Button>
        ) : (
          <Button variant="outline" onClick={solicitarAlteracao}>
            Solicitar alteração ao admin
          </Button>
        )}
        <Button variant="ghost" onClick={() => router.back()}>Cancelar</Button>
      </div>
    </div>
  )
}

function Field({
  label, value, setValue, disabled,
}: { label: string; value: number; setValue: (n: number) => void; disabled?: boolean }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-gray-700">{label}</label>
      <Input type="number" min={0} max={60} value={value} onChange={(e) => setValue(Number(e.target.value))} disabled={disabled} />
    </div>
  )
}
