import { requireSession } from '@/lib/session'
import { api } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Users, Plus } from 'lucide-react'
import Link from 'next/link'

interface Colaborador {
  id: string
  nome_completo: string
  matricula: string
  cpf: string
  cargo?: string
  ativo: boolean
  onboarding_ok: boolean
}

export default async function ColaboradoresPage() {
  const session = await requireSession()
  const colaboradores = await api
    .get<Colaborador[]>('/v1/colaboradores', session.token)
    .catch(() => null)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Colaboradores</h1>
          <p className="text-gray-500 text-sm mt-1">{colaboradores?.length ?? 0} cadastrado(s)</p>
        </div>
        <Button asChild>
          <Link href="/dashboard/colaboradores/novo">
            <Plus className="h-4 w-4" />
            Novo colaborador
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {!colaboradores || colaboradores.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <Users className="h-12 w-12 mb-3 opacity-30" />
              <p className="mb-4">Nenhum colaborador cadastrado</p>
              <Button asChild variant="outline">
                <Link href="/dashboard/colaboradores/novo">
                  <Plus className="h-4 w-4" />
                  Cadastrar primeiro colaborador
                </Link>
              </Button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Nome</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Matrícula</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">LGPD</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {colaboradores.map((c) => (
                  <tr key={c.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{c.nome_completo}</td>
                    <td className="px-4 py-3 text-gray-500 font-mono">{c.matricula}</td>
                    <td className="px-4 py-3">
                      <Badge variant={c.ativo ? 'default' : 'secondary'}>
                        {c.ativo ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={c.onboarding_ok ? 'success' : 'outline'}>
                        {c.onboarding_ok ? 'Aceito' : 'Pendente'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/dashboard/colaboradores/editar?id=${c.id}`}
                        className="text-blue-600 hover:underline text-xs"
                      >
                        Editar
                      </Link>
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
