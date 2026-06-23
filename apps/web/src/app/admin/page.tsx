import { requireSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { IpWhitelistForm } from './ip-whitelist-form'
import { api } from '@/lib/api'

interface Tenant {
  id: string
  nome: string
  ips_permitidos: string[]
}

export default async function AdminPage() {
  const session = await requireSession()
  if (session.role !== 'ADMIN_TENANT') redirect('/dashboard')

  const tenant = await api
    .get<Tenant>('/v1/tenant', session.token)
    .catch(() => null)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Administração</h1>
        <p className="text-gray-500 text-sm mt-1">{tenant?.nome ?? 'Configurações do tenant'}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">IPs permitidos para marcação</CardTitle>
          <CardDescription>
            Colaboradores só podem bater ponto quando conectados a estes IPs ou redes.
            Deixe vazio para permitir de qualquer lugar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <IpWhitelistForm
            ipsAtuais={tenant?.ips_permitidos ?? []}
            token={session.token}
          />
        </CardContent>
      </Card>
    </div>
  )
}
