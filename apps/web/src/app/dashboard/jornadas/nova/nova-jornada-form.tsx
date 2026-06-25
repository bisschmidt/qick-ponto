'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { criarJornadaAction } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'
import { HorariosPorDiaEditor, type DiaHorario } from '../horarios-por-dia'

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export function NovaJornadaForm() {
  const router = useRouter()
  const [nome, setNome] = useState('')
  const [tipo, setTipo] = useState('CALL_CENTER_NR17')
  const [horaInicio, setHoraInicio] = useState('08:00')
  const [horaFim, setHoraFim] = useState('14:00')
  const [dias, setDias] = useState<number[]>([1, 2, 3, 4, 5])
  const [validaFeriado, setValidaFeriado] = useState(false)
  const [tolEntrada, setTolEntrada] = useState(5)
  const [tolSaida, setTolSaida] = useState(5)
  const [tolInterv, setTolInterv] = useState(5)
  const [tolInicioInt, setTolInicioInt] = useState(5)
  const [janelaMarc, setJanelaMarc] = useState(15)
  const [horarios, setHorarios] = useState<DiaHorario[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const ehNR17 = tipo === 'CALL_CENTER_NR17' || tipo === 'CALL_CENTER_COMP'

  function toggleDia(d: number) {
    setDias((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d].sort((a, b) => a - b)))
  }

  function salvar() {
    setErro(null)
    if (nome.trim().length < 2) { setErro('Nome muito curto'); return }
    if (dias.length === 0) { setErro('Selecione ao menos um dia'); return }
    startTransition(async () => {
      const r = await criarJornadaAction({
        nome: nome.trim(),
        tipo,
        hora_inicio: horaInicio,
        hora_fim: horaFim,
        dias_semana: dias,
        valida_feriado: validaFeriado,
        tolerancia_atraso_entrada: tolEntrada,
        tolerancia_atraso_intervalo: tolInterv,
        tolerancia_antec_saida: tolSaida,
        tolerancia_antec_inicio_interv: tolInicioInt,
        janela_marcacao_min: janelaMarc,
        horarios: horarios.filter((h) => dias.includes(h.dia_semana)),
      })
      if (r && !r.ok) { setErro(r.error); return }
      router.push('/dashboard/jornadas')
    })
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6 space-y-4">
          <h2 className="font-semibold text-gray-700">Dados da jornada</h2>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Nome *</label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Call Center 6h — Turno Manhã" />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Tipo *</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <option value="CALL_CENTER_NR17">Call Center NR-17 (6h)</option>
              <option value="CALL_CENTER_COMP">Call Center Compensação (6x1)</option>
              <option value="PADRAO_CLT">Padrão CLT (8h)</option>
              <option value="JORNADA_12_36">12×36</option>
              <option value="JORNADA_24_48">24×48</option>
              <option value="PERSONALIZADA">Personalizada</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Hora início (base) *</label>
              <Input type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Hora fim (base) *</label>
              <Input type="time" value={horaFim} onChange={(e) => setHoraFim(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Dias da semana *</label>
            <div className="flex gap-2 flex-wrap">
              {DIAS.map((dia, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggleDia(i)}
                  className={`px-3 py-1.5 rounded-md text-sm border ${dias.includes(i) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600'}`}
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
              ehNR17={ehNR17}
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={validaFeriado} onChange={(e) => setValidaFeriado(e.target.checked)} className="rounded" />
            <span className="text-sm text-gray-700">Trabalha em feriados</span>
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <h2 className="font-semibold text-gray-700">Tolerâncias (minutos)</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <TolField label="Atraso na entrada" value={tolEntrada} setValue={setTolEntrada} />
            <TolField label="Antecipação da saída" value={tolSaida} setValue={setTolSaida} />
            <TolField label="Atraso no intervalo" value={tolInterv} setValue={setTolInterv} />
            <TolField label="Antecipação início intervalo" value={tolInicioInt} setValue={setTolInicioInt} />
            <TolField label="Janela de marcação" value={janelaMarc} setValue={setJanelaMarc} />
          </div>
        </CardContent>
      </Card>

      {erro && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{erro}</div>
      )}

      <div className="flex gap-3">
        <Button onClick={salvar} disabled={pending}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          Criar jornada
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancelar</Button>
      </div>
    </div>
  )
}

function TolField({ label, value, setValue }: { label: string; value: number; setValue: (n: number) => void }) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <Input type="number" min={0} max={60} value={value} onChange={(e) => setValue(Number(e.target.value))} />
    </div>
  )
}
