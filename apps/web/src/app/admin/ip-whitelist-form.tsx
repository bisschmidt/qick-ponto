'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { saveIpsAction } from './actions'
import { Plus, Trash2, CheckCircle2, Loader2 } from 'lucide-react'

interface Props {
  ipsAtuais: string[]
  token: string
}

export function IpWhitelistForm({ ipsAtuais, token }: Props) {
  const [ips, setIps] = useState<string[]>(ipsAtuais.length > 0 ? ipsAtuais : [''])
  const [novo, setNovo] = useState('')
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const addIp = () => {
    const ip = novo.trim()
    if (!ip || ips.includes(ip)) return
    setIps((prev) => [...prev, ip])
    setNovo('')
  }

  const removeIp = (i: number) => setIps((prev) => prev.filter((_, idx) => idx !== i))

  const handleSave = () => {
    startTransition(async () => {
      setError('')
      const res = await saveIpsAction(ips.filter(Boolean), token)
      if (res.ok) {
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      } else {
        setError(res.error)
      }
    })
  }

  return (
    <div className="space-y-4">
      {/* Lista de IPs */}
      <div className="space-y-2">
        {ips.map((ip, i) => (
          <div key={i} className="flex gap-2">
            <Input
              value={ip}
              onChange={(e) => setIps((prev) => prev.map((v, idx) => idx === i ? e.target.value : v))}
              placeholder="Ex: 192.168.1.0/24 ou 201.55.12.3"
              className="font-mono text-sm"
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => removeIp(i)}
              className="text-red-400 hover:text-red-600 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      {/* Adicionar novo IP */}
      <div className="flex gap-2">
        <Input
          value={novo}
          onChange={(e) => setNovo(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addIp()}
          placeholder="Adicionar IP ou CIDR..."
          className="font-mono text-sm"
        />
        <Button variant="outline" onClick={addIp}>
          <Plus className="h-4 w-4" />
          Adicionar
        </Button>
      </div>

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      <div className="flex items-center gap-3 pt-2">
        <Button onClick={handleSave} disabled={isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Salvar IPs
        </Button>
        {saved && (
          <span className="flex items-center gap-1.5 text-sm text-green-600">
            <CheckCircle2 className="h-4 w-4" />
            Salvo!
          </span>
        )}
      </div>

      <p className="text-xs text-gray-400">
        Aceita IPs individuais (ex: <code>201.55.12.3</code>) ou blocos CIDR (ex: <code>192.168.1.0/24</code>).
        A verificação é feita no momento da marcação.
      </p>
    </div>
  )
}
