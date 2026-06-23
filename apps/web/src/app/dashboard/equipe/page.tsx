import { requireSession } from '@/lib/session'
import { api } from '@/lib/api'
import { EquipeClient } from './equipe-client'

interface MembroTime {
  colaborador_id: string
  nome: string
  matricula: string
  marcacoes_dia: number
  status: string
  minutos_trabalhados: number
  minutos_he50: number
  minutos_atraso: number
  inconsistencias: string[]
  ajuste: { id: string; status: string; motivo: string } | null
}

interface Pendencia {
  id: string
  status: string
  tipo_ajuste: string
  motivo: { descricao: string }
  colaborador: { id: string; nome_completo: string; matricula: string }
  data_ponto: string
  justificativa: string
  created_at: string
  novo_timestamp: string | null
  novo_tipo: string | null
}

interface AlertaEquipe {
  colaborador_id: string
  nome: string
  matricula: string
  faltas_consecutivas: number
  alerta: string | null
}

function hoje(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default async function EquipePage({
  searchParams,
}: {
  searchParams: Promise<{ data?: string }>
}) {
  const session = await requireSession()
  const { data: q } = await searchParams
  const data = q ?? '2026-06-20' // último dia do piloto por default

  const [timeDia, pendencias, alertas] = await Promise.all([
    api.get<MembroTime[]>(`/v1/gestor/time-no-dia?data=${data}`, session.token).catch(() => []),
    api.get<Pendencia[]>('/v1/gestor/pendencias', session.token).catch(() => []),
    api.get<AlertaEquipe[]>('/v1/gestor/alertas-equipe', session.token).catch(() => []),
  ])

  return <EquipeClient data={data} timeDia={timeDia} pendencias={pendencias} alertas={alertas} role={session.role} />
}
