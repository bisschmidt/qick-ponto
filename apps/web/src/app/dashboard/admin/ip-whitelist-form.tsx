'use client'

import { useActionState } from 'react'
import { salvarIpsAction } from './actions'
import { Button } from '@/components/ui/button'
import { Loader2, Save, CheckCircle2 } from 'lucide-react'

export function IpWhitelistForm({ initialIps }: { initialIps: string[] }) {
  const [state, action, isPending] = useActionState(salvarIpsAction, undefined)

  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="text-sm font-medium text-gray-700 block mb-2">
          IPs permitidos (um por linha)
        </label>
        <textarea
          name="ips"
          rows={6}
          defaultValue={initialIps.join('\n')}
          placeholder={'192.168.1.100\n10.0.0.0/24'}
          className="w-full max-w-md rounded-md border border-input bg-background px-3 py-2 text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <p className="text-xs text-gray-400 mt-1">Aceita IPs individuais ou notação CIDR (ex: 192.168.0.0/24)</p>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar
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
