import { requireSession } from '@/lib/session'
import { api } from '@/lib/api'
import { ApuracaoForm } from './apuracao-form'
import { SectionTabs, FOLHA_TABS } from '@/components/dashboard/section-tabs'

interface Colaborador { id: string; nome_completo: string; matricula: string }

export default async function ApuracaoPage() {
  const session = await requireSession()

  const colaboradores = await api
    .get<Colaborador[]>('/v1/colaboradores', session.token)
    .catch(() => [] as Colaborador[])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Folha</h1>
        <p className="text-gray-500 text-sm mt-1">
          Selecione o colaborador e o período, depois clique em <strong>Apurar</strong>.
          Os resultados aparecem imediatamente abaixo.
        </p>
      </div>

      <SectionTabs tabs={FOLHA_TABS} />

      <ApuracaoForm colaboradores={colaboradores} />
    </div>
  )
}
