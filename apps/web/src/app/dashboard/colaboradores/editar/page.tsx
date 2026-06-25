import { requireSession } from '@/lib/session'
import { api } from '@/lib/api'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { FichaColaboradorClient } from './ficha-colaborador-client'

interface Colaborador {
  id: string
  nome_completo: string
  nome_social: string | null
  usar_nome_social: boolean
  cpf: string
  pis_nit: string
  matricula: string
  email_corporativo: string | null
  whatsapp: string | null
  centro_custo: string
  operacao_cliente: string
  cargo: string | null
  time_nome: string | null
  departamento: string | null
  validacao_facial: boolean
  canal_app: boolean
  canal_quiosque: boolean
  canal_computador: boolean
  onboarding_ok: boolean
  ativo: boolean
  data_desligamento: string | null
  cnpj_estab: { id: string; cnpj: string; razao_social: string; uf: string } | null
  usuario: { perfil: string } | null
  jornadas: { id: string; jornada: { id: string; nome: string } }[]
  codigos_folha?: { sistema: string; codigo: string }[]
}

interface Jornada { id: string; nome: string }

interface MarcacaoHist {
  id: string
  nsr: string
  tipo: string
  canal: string
  timestamp_marcacao: string
  fora_da_area: boolean
  fora_da_janela: boolean
  ajustes: {
    id: string
    tipo_ajuste: string
    status: string
    justificativa: string
    novo_timestamp: string | null
    novo_tipo: string | null
    created_at: string
  }[]
}

interface Dispositivo {
  canal: string
  total: number
  primeiro: string
  ultimo: string
  foraDaArea: number
}

export default async function EditarColaboradorPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>
}) {
  const { id } = await searchParams
  if (!id) return notFound()

  const session = await requireSession()
  const [colaborador, jornadas, marcacoes, dispositivos] = await Promise.all([
    api.get<Colaborador>(`/v1/colaboradores/${id}`, session.token).catch(() => null),
    api.get<Jornada[]>('/v1/jornadas', session.token).catch(() => []),
    api.get<MarcacaoHist[]>(`/v1/colaboradores/${id}/marcacoes`, session.token).catch(() => []),
    api.get<Dispositivo[]>(`/v1/colaboradores/${id}/dispositivos`, session.token).catch(() => []),
  ])

  if (!colaborador) return notFound()

  const jornadaAtual = colaborador.jornadas[0]?.jornada ?? null
  const nomeExibido = colaborador.usar_nome_social && colaborador.nome_social
    ? colaborador.nome_social
    : colaborador.nome_completo

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/colaboradores" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{nomeExibido}</h1>
          <p className="text-gray-500 text-sm mt-0.5 font-mono">{colaborador.matricula}</p>
        </div>
      </div>

      <FichaColaboradorClient
        colaborador={colaborador}
        jornadaAtual={jornadaAtual}
        jornadas={jornadas}
        codigoQuestor={colaborador.codigos_folha?.find((c) => c.sistema === 'QUESTOR')?.codigo ?? ''}
        userRole={session.role}
        marcacoes={marcacoes}
        dispositivos={dispositivos}
      />
    </div>
  )
}
