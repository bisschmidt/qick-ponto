'use client'

import { useActionState } from 'react'
import { criarJornadaAction } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export function NovaJornadaForm() {
  const [state, action, isPending] = useActionState(criarJornadaAction, undefined)

  return (
    <form action={action} className="space-y-6">
      <Card>
        <CardContent className="pt-6 space-y-4">
          <h2 className="font-semibold text-gray-700">Dados da jornada</h2>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Nome *</label>
            <Input name="nome" placeholder="Ex: Call Center 6h — Turno Manhã" required />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Tipo *</label>
            <select name="tipo" required className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
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
              <label className="text-sm font-medium text-gray-700">Hora início *</label>
              <Input name="hora_inicio" type="time" required defaultValue="08:00" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Hora fim *</label>
              <Input name="hora_fim" type="time" required defaultValue="14:00" />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Dias da semana *</label>
            <div className="flex gap-2 flex-wrap">
              {DIAS.map((dia, i) => (
                <label key={i} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    name="dias_semana"
                    value={i}
                    defaultChecked={i >= 1 && i <= 5}
                    className="rounded"
                  />
                  <span className="text-sm">{dia}</span>
                </label>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" name="valida_feriado" className="rounded" />
            <span className="text-sm text-gray-700">Trabalha em feriados</span>
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <h2 className="font-semibold text-gray-700">Tolerâncias (minutos)</h2>
          <div className="grid grid-cols-2 gap-4">
            <TolField label="Atraso na entrada" name="tol_entrada" defaultValue={5} />
            <TolField label="Antecipação da saída" name="tol_saida" defaultValue={5} />
            <TolField label="Atraso no intervalo" name="tol_intervalo" defaultValue={5} />
            <TolField label="Antecipação início intervalo" name="tol_inicio_interv" defaultValue={5} />
            <TolField label="Janela de marcação (min)" name="janela_marcacao" defaultValue={15} />
          </div>
        </CardContent>
      </Card>

      {state?.error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      )}

      <div className="flex gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Criar jornada
        </Button>
        <Button type="button" variant="outline" onClick={() => history.back()}>Cancelar</Button>
      </div>
    </form>
  )
}

function TolField({ label, name, defaultValue }: { label: string; name: string; defaultValue: number }) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <Input name={name} type="number" min={0} max={60} defaultValue={defaultValue} />
    </div>
  )
}
