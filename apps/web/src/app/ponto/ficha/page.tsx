import { requireSession } from '@/lib/session'
import { api } from '@/lib/api'
import { FichaPontoClient } from './ficha-client'

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

function mesAtual(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default async function FichaPontoPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>
}) {
  const session = await requireSession()
  const { mes } = await searchParams
  const mesSelecionado = mes ?? '2026-06' // Default pro mês do piloto

  const ficha = await api
    .get<Ficha>(`/v1/ponto/minha-ficha?mes=${mesSelecionado}`, session.token)
    .catch(() => null)

  if (!ficha) {
    return (
      <div className="max-w-3xl mx-auto">
        <p className="text-center text-gray-500 py-10">Não foi possível carregar a ficha</p>
      </div>
    )
  }

  return <FichaPontoClient ficha={ficha} />
}
