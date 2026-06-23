import { requireSession } from '@/lib/session'
import { api } from '@/lib/api'
import { CompensacaoClient } from './compensacao-client'

interface MinhaHe {
  id: string
  data: string
  hora_inicio: string
  hora_fim: string
  tipo: string
  status: string
  motivo: string | null
  compensacao_id: string | null
}
interface MinhaCompensacao {
  id: string
  data_falta: string
  motivo: string
  status: string
  resultado: string | null
  hes: { data: string; hora_inicio: string; hora_fim: string; status: string }[]
}

export default async function CompensacaoPage() {
  const session = await requireSession()
  const dados = await api
    .get<{ hes: MinhaHe[]; compensacoes: MinhaCompensacao[] }>('/v1/he/minhas', session.token)
    .catch(() => ({ hes: [], compensacoes: [] }))

  return <CompensacaoClient hes={dados.hes} compensacoes={dados.compensacoes} />
}
