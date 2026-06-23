'use client'

import { useState, useTransition } from 'react'
import { fecharPeriodoAction } from './actions'
import { Button } from '@/components/ui/button'
import { Loader2, Lock } from 'lucide-react'

export function FecharPeriodoBtn({ periodoId, cnpjEstabId }: { periodoId: string; cnpjEstabId: string }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  const handleFechar = () => {
    if (!confirm('Fechar este período é irreversível. Confirma?')) return
    startTransition(async () => {
      const res = await fecharPeriodoAction(periodoId, cnpjEstabId)
      if (!res.ok) setError(res.error ?? 'Erro')
    })
  }

  return (
    <div className="flex items-center gap-2 justify-end">
      {error && <span className="text-xs text-red-600">{error}</span>}
      <Button size="sm" variant="outline" onClick={handleFechar} disabled={isPending}>
        {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Lock className="h-3 w-3" />}
        Fechar período
      </Button>
    </div>
  )
}
