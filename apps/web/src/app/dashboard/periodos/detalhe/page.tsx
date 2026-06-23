import { requireSession } from '@/lib/session'
import { api } from '@/lib/api'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { fmtDataCurta } from '@/lib/utils'
import { ArrowLeft, FileText } from 'lucide-react'
import { EspelhoAcoes } from './espelho-acoes'

interface Espelho {
  id: string
  status: string
  colaborador: { nome_completo: string; matricula: string }
  assinado_colaborador_at: string | null
  nao_manifestado_at: string | null
}

interface Periodo {
  id: string
  data_inicio: string
  data_fim: string
  fechado: boolean
  espelhos: Espelho[]
}

const STATUS: Record<string, { label: string; variant: 'warning' | 'success' | 'secondary' | 'outline' }> = {
  PENDENTE:          { label: 'Aguardando assinatura', variant: 'warning' },
  ASSINADO_COLAB:    { label: 'Assinado pelo colaborador', variant: 'success' },
  NAO_MANIFESTADO:   { label: 'Não manifestado', variant: 'secondary' },
  HOMOLOGADO:        { label: 'Homologado', variant: 'success' },
}

export default async function PeriodoDetalhePage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams
  if (!id) return notFound()

  const session = await requireSession()
  const periodo = await api.get<Periodo>(`/v1/periodo/${id}`, session.token).catch(() => null)
  if (!periodo) return notFound()

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/periodos" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Período {fmtDataCurta(periodo.data_inicio)} — {fmtDataCurta(periodo.data_fim)}
          </h1>
          <p className="text-gray-500 text-sm mt-1">{periodo.espelhos.length} espelho(s)</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Espelhos de ponto</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {periodo.espelhos.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-10">
              Nenhum espelho gerado. Feche o período para gerar os espelhos.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Colaborador</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Assinado em</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {periodo.espelhos.map((e) => {
                  const s = STATUS[e.status] ?? { label: e.status, variant: 'outline' as const }
                  return (
                    <tr key={e.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{e.colaborador.nome_completo}</p>
                        <p className="text-xs text-gray-400">{e.colaborador.matricula}</p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={s.variant}>{s.label}</Badge>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {e.assinado_colaborador_at ? fmtDataCurta(e.assinado_colaborador_at) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center gap-2 justify-end">
                          <a
                            href={`/api/espelho?id=${e.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-blue-600 hover:underline text-xs"
                          >
                            <FileText className="h-3 w-3" /> PDF
                          </a>
                          <EspelhoAcoes espelhoId={e.id} status={e.status} role={session.role} />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
