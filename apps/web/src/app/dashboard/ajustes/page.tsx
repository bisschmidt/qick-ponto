import { requireSession } from '@/lib/session'
import { api } from '@/lib/api'
import { Clock } from 'lucide-react'
import { SolicitacoesAccordion } from './solicitacoes-accordion'
import { InconsistenciasSection } from './inconsistencias-section'

interface Ajuste {
  id: string
  status: string
  tipo_ajuste: string
  motivo: { descricao: string }
  colaborador: { id: string; nome_completo: string; matricula: string }
  data_ponto: string
  justificativa: string
  novo_timestamp: string | null
  novo_tipo: string | null
  created_at: string
}

interface Motivo { id: string; descricao: string }
interface ItemInconsistencia {
  colaborador_id: string
  colaborador_nome: string
  colaborador_matricula: string
  data: string
  descricoes: string[]
  ja_justificado: boolean
  motivo_justificado: string | null
}
interface InconsistenciasResponse {
  inconsistencias: ItemInconsistencia[]
  faltas: ItemInconsistencia[]
}

const STATUS_BADGE: Record<string, { label: string; variant: 'warning' | 'success' | 'destructive' | 'secondary' }> = {
  PENDENTE_GESTOR:  { label: 'Aguardando Gestor', variant: 'warning' },
  APROVADO_GESTOR:  { label: 'Aprovado Gestor',    variant: 'success' },
  PENDENTE_RH:      { label: 'Aguardando RH',      variant: 'warning' },
  APROVADO_RH:      { label: 'Aprovado',           variant: 'success' },
  REPROVADO_GESTOR: { label: 'Reprovado Gestor',   variant: 'destructive' },
  REPROVADO_RH:     { label: 'Reprovado RH',       variant: 'destructive' },
}

// Período default: mês atual
function periodoDefault() {
  const hoje = new Date()
  const inicio = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`
  const ultimoDia = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate()
  const fim = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`
  return { inicio, fim }
}

export default async function AjustesPage({
  searchParams,
}: {
  searchParams: Promise<{ inicio?: string; fim?: string }>
}) {
  const session = await requireSession()
  const { inicio: qInicio, fim: qFim } = await searchParams
  const { inicio: defInicio, fim: defFim } = periodoDefault()
  const inicio = qInicio ?? '2026-06-01'
  const fim    = qFim    ?? '2026-06-20'

  const [pendentes, dados, motivos] = await Promise.all([
    api.get<Ajuste[]>('/v1/ajustes/pendentes', session.token).catch(() => [] as Ajuste[]),
    api.get<InconsistenciasResponse>(`/v1/apuracao/inconsistencias?data_inicio=${inicio}&data_fim=${fim}`, session.token).catch(() => ({ inconsistencias: [], faltas: [] } as InconsistenciasResponse)),
    api.get<Motivo[]>('/v1/motivos-ajuste', session.token).catch(() => [] as Motivo[]),
  ])

  const inconsistenciasPendentes = dados.inconsistencias.filter((i) => !i.ja_justificado)
  const faltasPendentes          = dados.faltas.filter((i) => !i.ja_justificado)
  const jaJustificadas           = [...dados.inconsistencias, ...dados.faltas].filter((i) => i.ja_justificado)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Ajustes & Inconsistências</h1>
        <p className="text-gray-500 text-sm mt-1">
          Regularize as faltas e inconsistências antes de fechar o período
        </p>
      </div>

      <InconsistenciasSection
        inicio={inicio}
        fim={fim}
        inconsistencias={inconsistenciasPendentes}
        faltas={faltasPendentes}
        jaJustificadas={jaJustificadas}
        motivos={motivos}
      />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-700 flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Solicitações em aberto ({pendentes.length})
        </h2>
        <SolicitacoesAccordion pendentes={pendentes} role={session.role} />
      </section>
    </div>
  )
}
