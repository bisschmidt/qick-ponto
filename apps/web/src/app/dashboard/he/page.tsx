import { requireSession } from '@/lib/session'
import { api } from '@/lib/api'
import { HeClient } from './he-client'

interface ColabRef { id: string; nome_completo: string; matricula: string }
interface HeView {
  id: string
  colaborador: ColabRef
  data: string
  hora_inicio: string
  hora_fim: string
  tipo: string
  status: string
  compensacao_id: string | null
  motivo: string | null
}
interface CompPendente {
  id: string
  colaborador: ColabRef
  data_falta: string
  motivo: string
  dias: { data: string; hora_inicio: string; hora_fim: string }[]
}
interface HeTime {
  aguardandoAceite: HeView[]
  aguardandoMarcacao: HeView[]
  realizadas: HeView[]
  faltaHe: HeView[]
  compensacoesPendentes: CompPendente[]
}
interface MembroTime { id: string; nome_completo: string; matricula: string }

export default async function HePage() {
  const session = await requireSession()

  const [time, membros] = await Promise.all([
    api.get<HeTime>('/v1/he/time', session.token).catch(() => null),
    api.get<MembroTime[]>('/v1/gestor/meu-time', session.token).catch(() => []),
  ])

  const vazio: HeTime = {
    aguardandoAceite: [], aguardandoMarcacao: [], realizadas: [], faltaHe: [], compensacoesPendentes: [],
  }

  return <HeClient time={time ?? vazio} membros={membros} />
}
