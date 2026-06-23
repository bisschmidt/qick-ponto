'use client'

import { useActionState } from 'react'
import { salvarConfigHeAction } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, Save, CheckCircle2 } from 'lucide-react'

interface ConfigHe {
  max_min_dia: number
  max_min_semana: number
  max_min_mes: number
  intervalo_min_apos_jornada_min: number
}

export function ConfigHeForm({ config }: { config: ConfigHe }) {
  const [state, action, isPending] = useActionState(salvarConfigHeAction, undefined)
  const h = (min: number) => (min / 60).toString()

  return (
    <form action={action} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-lg">
        <Campo name="max_dia_h" label="Máx. por dia (h)" def={h(config.max_min_dia)} />
        <Campo name="max_semana_h" label="Máx. por semana (h)" def={h(config.max_min_semana)} />
        <Campo name="max_mes_h" label="Máx. por mês (h)" def={h(config.max_min_mes)} />
      </div>
      <div className="max-w-xs">
        <label className="text-sm font-medium text-gray-700 block mb-1">
          Intervalo mínimo entre jornada e HE (min)
        </label>
        <Input name="intervalo_min" type="number" min={0} step={5}
          defaultValue={config.intervalo_min_apos_jornada_min} />
      </div>
      <p className="text-xs text-gray-400">
        O sistema bloqueia qualquer lançamento de HE que ultrapasse estes limites. O teto diário não se
        aplica a dias fora da escala do colaborador (ex.: sábado).
      </p>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar limites
        </Button>
        {state?.ok === true && (
          <span className="flex items-center gap-1 text-sm text-green-600">
            <CheckCircle2 className="h-4 w-4" /> Salvo!
          </span>
        )}
        {state && !state.ok && <p className="text-sm text-red-600">{state.error}</p>}
      </div>
    </form>
  )
}

function Campo({ name, label, def }: { name: string; label: string; def: string }) {
  return (
    <div>
      <label className="text-sm font-medium text-gray-700 block mb-1">{label}</label>
      <Input name={name} type="number" min={0} step={0.5} defaultValue={def} />
    </div>
  )
}
