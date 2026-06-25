import { requireSession } from '@/lib/session'
import { api } from '@/lib/api'
import { FeriadosClient } from './feriados-client'
import { SectionTabs, adminTabsFor } from '@/components/dashboard/section-tabs'

interface Feriado {
  id: string
  nome: string
  tipo: string
  uf: string | null
  municipio: string | null
  data_inicio: string
  data_fim: string
}

export default async function FeriadosPage({
  searchParams,
}: {
  searchParams: Promise<{ ano?: string }>
}) {
  const session = await requireSession()
  const { ano } = await searchParams
  const anoSel = ano ?? '2026'
  const lista = await api
    .get<Feriado[]>(`/v1/feriados?ano=${anoSel}`, session.token)
    .catch(() => [])
  return (
    <div className="space-y-5 max-w-4xl">
      <SectionTabs tabs={adminTabsFor(session.role)} />
      <FeriadosClient ano={anoSel} lista={lista} />
    </div>
  )
}
