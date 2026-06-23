'use client'

import { useTransition } from 'react'
import { aprovarGestorAction, reprovarGestorAction, aprovarRhAction, reprovarRhAction } from './actions'
import { Button } from '@/components/ui/button'
import { Check, X, Loader2 } from 'lucide-react'

interface Props { ajusteId: string; status: string; role: string }

export function AjusteAcoes({ ajusteId, status, role }: Props) {
  const [isPending, startTransition] = useTransition()

  const aprovar = (encaminharRh = false) => startTransition(async () => {
    if (status === 'PENDENTE_GESTOR') await aprovarGestorAction(ajusteId, encaminharRh)
    else await aprovarRhAction(ajusteId)
  })

  const reprovar = () => startTransition(async () => {
    if (status === 'PENDENTE_GESTOR') await reprovarGestorAction(ajusteId)
    else await reprovarRhAction(ajusteId)
  })

  if (status === 'PENDENTE_GESTOR' && (role === 'GESTOR' || role === 'ADMIN_TENANT')) {
    return (
      <div className="flex gap-2 shrink-0">
        <Button size="sm" variant="outline" className="text-green-600 border-green-200 hover:bg-green-50" onClick={() => aprovar(false)} disabled={isPending}>
          {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
          Aprovar
        </Button>
        <Button size="sm" variant="outline" className="text-blue-600 border-blue-200 hover:bg-blue-50" onClick={() => aprovar(true)} disabled={isPending}>
          → RH
        </Button>
        <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={reprovar} disabled={isPending}>
          <X className="h-3 w-3" />
          Reprovar
        </Button>
      </div>
    )
  }

  if (status === 'PENDENTE_RH' && (role === 'RH_DP' || role === 'ADMIN_TENANT')) {
    return (
      <div className="flex gap-2 shrink-0">
        <Button size="sm" variant="outline" className="text-green-600 border-green-200 hover:bg-green-50" onClick={() => aprovar()} disabled={isPending}>
          {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
          Aprovar
        </Button>
        <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={reprovar} disabled={isPending}>
          <X className="h-3 w-3" />
          Reprovar
        </Button>
      </div>
    )
  }

  return null
}
