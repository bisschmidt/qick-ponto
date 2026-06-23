import { requireSession } from '@/lib/session'
import { api } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { fmtMinutos, fmtDataCurta } from '@/lib/utils'
import { Banknote } from 'lucide-react'

interface Resumo { totalMinutos: number; minutosVencendo: number }
interface Extrato {
  id: string
  tipo: 'CREDITO' | 'DEBITO'
  minutos: number
  origem: string
  data_referencia: string
  data_vencimento: string | null
  compensado: boolean
  colaborador: { nome_completo: string; matricula: string }
}

interface Colaborador { id: string; nome_completo: string; matricula: string }

export default async function BancoHorasPage() {
  const session = await requireSession()

  const [resumo, extrato, colaboradores] = await Promise.all([
    api.get<Resumo>('/v1/banco-horas/resumo', session.token).catch(() => null),
    api.get<Extrato[]>('/v1/banco-horas/extrato', session.token).catch(() => []),
    api.get<Colaborador[]>('/v1/colaboradores', session.token).catch(() => []),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Banco de Horas</h1>
        <p className="text-gray-500 text-sm mt-1">Saldo e movimentações</p>
      </div>

      {resumo && (
        <div className="grid grid-cols-2 gap-4 max-w-md">
          <Card>
            <CardContent className="p-5">
              <p className="text-xs text-gray-500 mb-1">Saldo total</p>
              <p className="text-2xl font-bold text-gray-900">{fmtMinutos(resumo.totalMinutos)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-xs text-gray-500 mb-1">Vencendo em 30 dias</p>
              <p className={`text-2xl font-bold ${resumo.minutosVencendo > 0 ? 'text-orange-600' : 'text-gray-900'}`}>
                {fmtMinutos(resumo.minutosVencendo)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Extrato</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {extrato.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-gray-400">
              <Banknote className="h-10 w-10 mb-2 opacity-30" />
              <p>Nenhuma movimentação</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Colaborador</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Tipo</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Horas</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Referência</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Vencimento</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody>
                {extrato.map((e) => (
                  <tr key={e.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{e.colaborador.nome_completo}</p>
                      <p className="text-xs text-gray-400">{e.colaborador.matricula}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={e.tipo === 'CREDITO' ? 'success' : 'warning'}>
                        {e.tipo === 'CREDITO' ? '+ Crédito' : '− Débito'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 font-mono font-medium">{fmtMinutos(e.minutos)}</td>
                    <td className="px-4 py-3 text-gray-500">{fmtDataCurta(e.data_referencia)}</td>
                    <td className="px-4 py-3 text-gray-500">{e.data_vencimento ? fmtDataCurta(e.data_vencimento) : '—'}</td>
                    <td className="px-4 py-3">
                      <Badge variant={e.compensado ? 'secondary' : 'outline'}>
                        {e.compensado ? 'Compensado' : 'Ativo'}
                      </Badge>
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
