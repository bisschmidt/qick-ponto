import { requireSession } from '@/lib/session'
import { api } from '@/lib/api'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { EditarJornadaForm } from './editar-jornada-form'

interface Jornada {
  id: string
  nome: string
  tipo: string
  hora_inicio: string
  hora_fim: string
  dias_semana: number[]
  valida_feriado: boolean
  tolerancia_atraso_entrada: number
  tolerancia_atraso_intervalo: number
  tolerancia_antec_saida: number
  tolerancia_antec_inicio_interv: number
  janela_marcacao_min: number
  pausas: {
    id: string
    nome: string
    ordem: number
    duracao_min: number
    eh_nr17: boolean
    eh_intervalo_refeicao: boolean
    computa_jornada: boolean
    janela_inicio_min: number | null
    janela_fim_min: number | null
  }[]
}

export default async function EditarJornadaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await requireSession()
  const jornada = await api.get<Jornada>(`/v1/jornadas/${id}`, session.token).catch(() => null)
  if (!jornada) return notFound()

  return (
    <div className="max-w-3xl space-y-6">
      <Link href="/dashboard/jornadas" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </Link>
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Editar jornada</h1>
        <p className="text-sm text-gray-500 mt-1">{jornada.nome}</p>
      </div>
      <EditarJornadaForm jornada={jornada} userRole={session.role} />
    </div>
  )
}
