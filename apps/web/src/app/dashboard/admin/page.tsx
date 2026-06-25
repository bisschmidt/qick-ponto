import { requireSession } from '@/lib/session'
import { api } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { IpWhitelistForm } from './ip-whitelist-form'
import { ConfigHeForm } from './config-he-form'
import { fmtDataCurta } from '@/lib/utils'
import { SectionTabs, adminTabsFor } from '@/components/dashboard/section-tabs'

interface Tenant {
  id: string
  razao_social: string
  plano: string
  ip_whitelist: string[]
  ativo: boolean
  created_at: string
}

interface ConfigHe {
  max_min_dia: number
  max_min_semana: number
  max_min_mes: number
  intervalo_min_apos_jornada_min: number
}

export default async function AdminPage() {
  const session = await requireSession()
  const [tenant, configHe] = await Promise.all([
    api.get<Tenant>('/v1/tenant', session.token).catch(() => null),
    api.get<ConfigHe>('/v1/he/config', session.token).catch(() => null),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Administração</h1>
        <p className="text-gray-500 text-sm mt-1">Configurações da empresa, feriados e exportações</p>
      </div>

      <SectionTabs tabs={adminTabsFor(session.role)} />

      {tenant && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dados do tenant</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="Empresa" value={tenant.razao_social} />
            <Row label="Plano"  value={tenant.plano} />
            <Row label="Status" value={tenant.ativo ? 'Ativo' : 'Inativo'} />
            <Row label="Desde"  value={fmtDataCurta(tenant.created_at)} />
            <Row label="ID"     value={tenant.id} mono />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Whitelist de IPs</CardTitle>
          <CardDescription>
            Quando preenchida, somente estes IPs poderão registrar marcações.
            Deixe em branco para permitir qualquer IP.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <IpWhitelistForm initialIps={tenant?.ip_whitelist ?? []} />
        </CardContent>
      </Card>

      {configHe && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Limites de Hora Extra</CardTitle>
            <CardDescription>
              Tetos de HE aplicados a todo o tenant. Bloqueiam lançamentos que os ultrapassem.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ConfigHeForm config={configHe} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex gap-3">
      <span className="text-gray-500 w-20 shrink-0">{label}</span>
      <span className={`text-gray-900 ${mono ? 'font-mono text-xs' : ''}`}>{value}</span>
    </div>
  )
}
