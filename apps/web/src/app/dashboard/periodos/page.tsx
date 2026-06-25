import { requireSession } from '@/lib/session'
import { api } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar } from 'lucide-react'
import { fmtDataCurta } from '@/lib/utils'
import Link from 'next/link'
import { CriarPeriodoForm } from './criar-periodo-form'
import { FecharPeriodoBtn } from './fechar-periodo-btn'
import { SectionTabs, FOLHA_TABS } from '@/components/dashboard/section-tabs'

interface Periodo {
  id: string
  nome?: string
  data_inicio: string
  data_fim: string
  fechado: boolean
  fechado_at: string | null
}

interface CnpjEstab { id: string; cnpj: string; razao_social: string }

export default async function PeriodosPage() {
  const session = await requireSession()
  const [periodos, estabs] = await Promise.all([
    api.get<Periodo[]>('/v1/periodo', session.token).catch(() => null),
    api.get<CnpjEstab[]>('/v1/cnpjs', session.token).catch(() => []),
  ])

  const estabId = estabs[0]?.id ?? ''

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Folha</h1>
        <p className="text-gray-500 text-sm mt-1">Períodos de fechamento, apuração e geração de espelhos</p>
      </div>

      <SectionTabs tabs={FOLHA_TABS} />

      <CriarPeriodoForm />

      <Card>
        <CardContent className="p-0">
          {!periodos || periodos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <Calendar className="h-12 w-12 mb-3 opacity-30" />
              <p>Nenhum período cadastrado</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Início</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Fim</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Fechado em</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {periodos.map((p) => (
                  <tr key={p.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-700">{fmtDataCurta(p.data_inicio)}</td>
                    <td className="px-4 py-3 text-gray-700">{fmtDataCurta(p.data_fim)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={p.fechado ? 'secondary' : 'success'}>
                        {p.fechado ? 'Fechado' : 'Aberto'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {p.fechado_at ? fmtDataCurta(p.fechado_at) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center gap-2 justify-end">
                        {p.fechado && (
                          <Link
                            href={`/dashboard/periodos/detalhe?id=${p.id}`}
                            className="text-blue-600 hover:underline text-xs"
                          >
                            Ver espelhos
                          </Link>
                        )}
                        {!p.fechado && estabId && (
                          <FecharPeriodoBtn periodoId={p.id} cnpjEstabId={estabId} />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
