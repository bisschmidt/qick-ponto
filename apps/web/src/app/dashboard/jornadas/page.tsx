import { requireSession } from '@/lib/session'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import Link from 'next/link'
import { JornadasClient, type JornadaGestao } from './jornadas-client'

export default async function JornadasPage() {
  const session = await requireSession()
  const jornadas = await api
    .get<JornadaGestao[]>('/v1/jornadas?gestao=1', session.token)
    .catch(() => [] as JornadaGestao[])

  const podeEditar = session.role === 'ADMIN_TENANT'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Jornadas</h1>
          <p className="text-gray-500 text-sm mt-1">{jornadas.length} cadastrada(s)</p>
        </div>
        {podeEditar && (
          <Button asChild>
            <Link href="/dashboard/jornadas/nova">
              <Plus className="h-4 w-4" />
              Nova jornada
            </Link>
          </Button>
        )}
      </div>

      <JornadasClient jornadas={jornadas} podeEditar={podeEditar} />
    </div>
  )
}
