'use client'

import { useActionState } from 'react'
import { criarPeriodoAction } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Plus, Loader2, CheckCircle2 } from 'lucide-react'

export function CriarPeriodoForm() {
  const [state, action, isPending] = useActionState(criarPeriodoAction, undefined)

  return (
    <Card>
      <CardContent className="pt-6">
        <h2 className="font-semibold text-gray-700 mb-4">Criar novo período</h2>
        <form action={action} className="flex items-end gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Data início</label>
            <Input name="data_inicio" type="date" required />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Data fim</label>
            <Input name="data_fim" type="date" required />
          </div>
          <Button type="submit" disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Criar período
          </Button>
          {state?.ok === true && (
            <span className="flex items-center gap-1 text-sm text-green-600">
              <CheckCircle2 className="h-4 w-4" /> Criado!
            </span>
          )}
          {state && !state.ok && <p className="text-sm text-red-600">{state.error}</p>}
        </form>
      </CardContent>
    </Card>
  )
}
