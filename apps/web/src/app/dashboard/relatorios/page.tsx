import { requireSession } from '@/lib/session'
import { api } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { fmtMinutos, fmtDataCurta } from '@/lib/utils'

interface Falta {
  colaboradorId: string
  nome: string
  matricula: string
  totalFaltas: number
  datas: string[]
}

interface FaltasResponse {
  colaboradores: Falta[]
}

interface HeItem {
  colaboradorId: string
  nome: string
  matricula: string
  minutosHe50: number
  minutosHe100: number
}

interface HeResponse {
  colaboradores: HeItem[]
}

function getMonthRange() {
  const now = new Date()
  return {
    data_inicio: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10),
    data_fim: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10),
  }
}

export default async function RelatoriosPage() {
  const session = await requireSession()
  const { data_inicio, data_fim } = getMonthRange()

  const [faltas, he] = await Promise.all([
    api.get<FaltasResponse>(`/v1/relatorios/faltas?data_inicio=${data_inicio}&data_fim=${data_fim}`, session.token).catch(() => null),
    api.get<HeResponse>(`/v1/relatorios/he?data_inicio=${data_inicio}&data_fim=${data_fim}`, session.token).catch(() => null),
  ])

  const mes = new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Relatórios</h1>
        <p className="text-gray-500 text-sm mt-1 capitalize">{mes}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Faltas */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Faltas no período</CardTitle>
          </CardHeader>
          <CardContent>
            {!faltas || faltas.colaboradores.length === 0 ? (
              <p className="text-gray-400 text-sm py-4 text-center">Sem faltas no período</p>
            ) : (
              <div className="space-y-3">
                {faltas.colaboradores.map((c) => (
                  <div key={c.colaboradorId} className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{c.nome}</p>
                      <p className="text-xs text-gray-400">{c.matricula}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-red-600">{c.totalFaltas}x</p>
                      <p className="text-xs text-gray-400">{c.datas.map(fmtDataCurta).join(', ')}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Horas extras */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Horas extras</CardTitle>
          </CardHeader>
          <CardContent>
            {!he || he.colaboradores.length === 0 ? (
              <p className="text-gray-400 text-sm py-4 text-center">Sem horas extras no período</p>
            ) : (
              <div className="space-y-3">
                {he.colaboradores.map((c) => (
                  <div key={c.colaboradorId} className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{c.nome}</p>
                      <p className="text-xs text-gray-400">{c.matricula}</p>
                    </div>
                    <div className="text-right text-sm">
                      <p className="text-orange-600 font-medium">50%: {fmtMinutos(c.minutosHe50)}</p>
                      <p className="text-red-600 font-medium">100%: {fmtMinutos(c.minutosHe100)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
