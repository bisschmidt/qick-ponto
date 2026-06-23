import { requireSession } from '@/lib/session'
import { api } from '@/lib/api'
import { NovoColaboradorForm } from './novo-colaborador-form'

interface Jornada { id: string; nome: string; tipo: string }
interface CnpjEstab { id: string; cnpj: string; razao_social: string }

export default async function NovoColaboradorPage() {
  const session = await requireSession()

  const [jornadas, estabs] = await Promise.all([
    api.get<Jornada[]>('/v1/jornadas', session.token).catch(() => []),
    api.get<CnpjEstab[]>('/v1/cnpjs', session.token).catch(() => []),
  ])

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Novo Colaborador</h1>
        <p className="text-gray-500 text-sm mt-1">Preencha os dados obrigatórios para cadastrar</p>
      </div>
      <NovoColaboradorForm jornadas={jornadas} estabs={estabs} />
    </div>
  )
}
