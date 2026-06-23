import { requireSession } from '@/lib/session'
import { api } from '@/lib/api'
import { FichaSubordinadoClient } from './ficha-sub-client'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { notFound } from 'next/navigation'

interface Ficha {
  colaborador: { id: string; nome: string; matricula: string }
  mes: string
  jornadaContratual: { nome: string; hora_inicio: string; hora_fim: string; dias_semana: number[] } | null
  dias: {
    data: string
    diaSemana: number
    ehFeriado: boolean
    ehDsr: boolean
    status: string
    jornadaContratual: { inicio: string; fim: string } | null
    marcacoes: { tipo: string; hora: string; nsr: string }[]
    totais: { minutosTrabalhados: number; minutosHe50: number; minutosHe100: number; minutosAtraso: number }
    inconsistencias: string[]
    ajustes: { id: string; status: string; tipo_ajuste: string; motivo: string; justificativa: string; novo_timestamp: string | null; novo_tipo: string | null }[]
  }[]
  total: { minutosTrabalhados: number; minutosHe50: number; minutosHe100: number; minutosAtraso: number; faltas: number }
}

interface Motivo { id: string; descricao: string }

export default async function FichaSubordinadoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ mes?: string }>
}) {
  const { id } = await params
  const { mes: mesQuery } = await searchParams
  const session = await requireSession()
  const mes = mesQuery ?? '2026-06'

  const [ficha, motivos] = await Promise.all([
    api.get<Ficha>(`/v1/gestor/ficha-subordinado?colaborador_id=${id}&mes=${mes}`, session.token).catch(() => null),
    api.get<Motivo[]>('/v1/motivos-ajuste', session.token).catch(() => []),
  ])
  if (!ficha) return notFound()

  return (
    <div className="space-y-4">
      <Link href="/dashboard/equipe" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
        <ArrowLeft className="h-4 w-4" />
        Voltar para equipe
      </Link>
      <FichaSubordinadoClient ficha={ficha} motivos={motivos} />
    </div>
  )
}
