'use client'

import { useTransition } from 'react'
import { assinarEspelhoAction, naoManifestadoAction } from './actions'
import { Button } from '@/components/ui/button'
import { Pen, MinusCircle, Loader2 } from 'lucide-react'

interface Props { espelhoId: string; status: string; role: string }

export function EspelhoAcoes({ espelhoId, status, role }: Props) {
  const [isPending, startTransition] = useTransition()

  const assinar = () => startTransition(async () => {
    await assinarEspelhoAction(espelhoId)
  })

  const naoManifestado = () => startTransition(async () => {
    if (!confirm('Marcar como não manifestado?')) return
    await naoManifestadoAction(espelhoId)
  })

  return (
    <div className="flex gap-1">
      {status === 'PENDENTE' && (
        <Button size="sm" variant="outline" onClick={assinar} disabled={isPending} className="text-xs">
          {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Pen className="h-3 w-3" />}
          Assinar
        </Button>
      )}
      {status === 'PENDENTE' && (role === 'RH_DP' || role === 'ADMIN_TENANT') && (
        <Button size="sm" variant="ghost" onClick={naoManifestado} disabled={isPending} className="text-xs text-gray-500">
          <MinusCircle className="h-3 w-3" />
          N/M
        </Button>
      )}
    </div>
  )
}
