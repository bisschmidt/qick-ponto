import { requireSession } from '@/lib/session'
import { api } from '@/lib/api'
import { fmtMinutos } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, Clock, AlertTriangle, TrendingUp } from 'lucide-react'

interface Dashboard {
  totalColaboradores: number
  totaisApuracao: {
    diasApurados: number
    minutosTrabalhados: number
    minutosHe50: number
    minutosHe100: number
    minutosAtraso: number
  }
  conformidadeNr17: { diasTotal: number; diasConformes: number; taxa: number }
  alertas: { ajustesPendentes: number; horasVencendoEm30Dias: number }
}

function getMonthRange() {
  const now = new Date()
  const inicio = new Date(now.getFullYear(), now.getMonth(), 1)
  const fim = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return {
    data_inicio: inicio.toISOString().slice(0, 10),
    data_fim: fim.toISOString().slice(0, 10),
  }
}

export default async function DashboardPage() {
  const session = await requireSession()
  const { data_inicio, data_fim } = getMonthRange()

  const data = await api
    .get<Dashboard>(`/v1/dashboard?data_inicio=${data_inicio}&data_fim=${data_fim}`, session.token)
    .catch(() => null)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">
          {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Colaboradores ativos"
          value={String(data?.totalColaboradores ?? '—')}
          icon={<Users className="h-5 w-5 text-blue-500" />}
          bg="bg-blue-50"
        />
        <KpiCard
          title="Horas trabalhadas"
          value={data ? fmtMinutos(data.totaisApuracao.minutosTrabalhados) : '—'}
          icon={<Clock className="h-5 w-5 text-green-500" />}
          bg="bg-green-50"
        />
        <KpiCard
          title="Horas extras (50%)"
          value={data ? fmtMinutos(data.totaisApuracao.minutosHe50) : '—'}
          icon={<TrendingUp className="h-5 w-5 text-orange-500" />}
          bg="bg-orange-50"
        />
        <KpiCard
          title="Ajustes pendentes"
          value={String(data?.alertas.ajustesPendentes ?? '—')}
          icon={<AlertTriangle className="h-5 w-5 text-red-500" />}
          bg="bg-red-50"
          alert={(data?.alertas.ajustesPendentes ?? 0) > 0}
        />
      </div>

      {/* NR-17 + Atrasos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Conformidade NR-17</CardTitle>
          </CardHeader>
          <CardContent>
            {data ? (
              <div className="space-y-3">
                <div className="flex items-end gap-2">
                  <span className="text-4xl font-bold text-gray-900">{data.conformidadeNr17.taxa}%</span>
                  <span className="text-gray-400 text-sm pb-1">dias conformes</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 rounded-full transition-all"
                    style={{ width: `${data.conformidadeNr17.taxa}%` }}
                  />
                </div>
                <p className="text-xs text-gray-400">
                  {data.conformidadeNr17.diasConformes} de {data.conformidadeNr17.diasTotal} dias
                </p>
              </div>
            ) : (
              <p className="text-gray-400 text-sm">Sem dados</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Atrasos no período</CardTitle>
          </CardHeader>
          <CardContent>
            {data ? (
              <div className="space-y-2">
                <div className="text-4xl font-bold text-gray-900">
                  {fmtMinutos(data.totaisApuracao.minutosAtraso)}
                </div>
                <p className="text-xs text-gray-400">Total de minutos de atraso</p>
                {data.alertas.horasVencendoEm30Dias > 0 && (
                  <div className="mt-3 rounded-md bg-yellow-50 border border-yellow-200 px-3 py-2 text-xs text-yellow-700">
                    {data.alertas.horasVencendoEm30Dias} registro(s) de banco de horas vencem em 30 dias
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-400 text-sm">Sem dados</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function KpiCard({
  title,
  value,
  icon,
  bg,
  alert,
}: {
  title: string
  value: string
  icon: React.ReactNode
  bg: string
  alert?: boolean
}) {
  return (
    <Card className={alert ? 'border-red-200' : ''}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm text-gray-500">{title}</p>
          <div className={`p-2 rounded-lg ${bg}`}>{icon}</div>
        </div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
      </CardContent>
    </Card>
  )
}
