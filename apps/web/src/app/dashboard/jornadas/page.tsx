import { requireSession } from '@/lib/session'
import { api } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Clock } from 'lucide-react'
import Link from 'next/link'

interface Jornada {
  id: string
  nome: string
  tipo: string
  hora_inicio: string
  hora_fim: string
  dias_semana: number[]
}

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export default async function JornadasPage() {
  const session = await requireSession()
  const jornadas = await api.get<Jornada[]>('/v1/jornadas', session.token).catch(() => null)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Jornadas</h1>
          <p className="text-gray-500 text-sm mt-1">{jornadas?.length ?? 0} cadastrada(s)</p>
        </div>
        <Button asChild>
          <Link href="/dashboard/jornadas/nova">
            <Plus className="h-4 w-4" />
            Nova jornada
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {!jornadas || jornadas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <Clock className="h-12 w-12 mb-3 opacity-30" />
              <p className="mb-4">Nenhuma jornada cadastrada</p>
              <Button asChild variant="outline">
                <Link href="/dashboard/jornadas/nova"><Plus className="h-4 w-4" />Criar jornada</Link>
              </Button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Nome</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Tipo</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Horário</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Dias</th>
                </tr>
              </thead>
              <tbody>
                {jornadas.map((j) => (
                  <tr key={j.id} className="border-b last:border-0 hover:bg-blue-50">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      <Link href={`/dashboard/jornadas/${j.id}`} className="hover:text-blue-700">{j.nome}</Link>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{j.tipo.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-3 font-mono text-gray-700">{j.hora_inicio} – {j.hora_fim}</td>
                    <td className="px-4 py-3 text-gray-500">{j.dias_semana.map((d) => DIAS[d]).join(', ')}</td>
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
