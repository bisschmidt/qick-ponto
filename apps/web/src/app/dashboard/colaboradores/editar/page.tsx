import { requireSession } from '@/lib/session'
import { api } from '@/lib/api'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { EditarColaboradorForm } from './editar-colaborador-form'

interface Colaborador {
  id: string
  nome_completo: string
  email_corporativo: string | null
  whatsapp: string | null
  centro_custo: string
  operacao_cliente: string
  onboarding_ok: boolean
  ativo: boolean
  data_desligamento: string | null
  jornadas: { id: string; jornada: { id: string; nome: string } }[]
  codigos_folha?: { sistema: string; codigo: string }[]
}

interface Jornada { id: string; nome: string }

export default async function EditarColaboradorPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>
}) {
  const { id } = await searchParams
  if (!id) return notFound()

  const session = await requireSession()
  const [colaborador, jornadas] = await Promise.all([
    api.get<Colaborador>(`/v1/colaboradores/${id}`, session.token).catch(() => null),
    api.get<Jornada[]>('/v1/jornadas', session.token).catch(() => []),
  ])

  if (!colaborador) return notFound()

  const jornadaAtual = colaborador.jornadas[0]?.jornada ?? null

  return (
    <div className="max-w-xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/colaboradores" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Editar colaborador</h1>
          <p className="text-gray-500 text-sm mt-0.5">{colaborador.nome_completo}</p>
        </div>
      </div>

      <EditarColaboradorForm
        colaborador={{
          id: colaborador.id,
          nome_completo: colaborador.nome_completo,
          email_corporativo: colaborador.email_corporativo ?? '',
          whatsapp: colaborador.whatsapp ?? '',
          centro_custo: colaborador.centro_custo,
          operacao_cliente: colaborador.operacao_cliente,
          onboarding_ok: colaborador.onboarding_ok,
          ativo: colaborador.ativo,
          data_desligamento: colaborador.data_desligamento,
        }}
        jornadaAtual={jornadaAtual}
        jornadas={jornadas}
        codigoQuestor={colaborador.codigos_folha?.find((c) => c.sistema === 'QUESTOR')?.codigo ?? ''}
        userRole={session.role}
      />
    </div>
  )
}
