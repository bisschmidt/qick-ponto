import { requireSession } from '@/lib/session'
import { api } from '@/lib/api'
import { ConfiguracaoForm } from './configuracao-form'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

interface Config {
  id: string
  sistema: string
  codigo_empresa: string
}

interface Mapeamento {
  id: string
  sistema: string
  evento: string
  codigo_externo: string
}

interface Sistemas {
  sistemas: string[]
  eventos: string[]
}

const SISTEMA = 'QUESTOR' as const

export default async function ConfiguracaoFolhaPage() {
  const session = await requireSession()
  const [sistemas, config, mapeamentos] = await Promise.all([
    api.get<Sistemas>('/v1/exportacao-folha/sistemas', session.token).catch(() => ({ sistemas: [SISTEMA], eventos: [] })),
    api.get<Config | null>(`/v1/exportacao-folha/config?sistema=${SISTEMA}`, session.token).catch(() => null),
    api.get<Mapeamento[]>(`/v1/exportacao-folha/mapeamento?sistema=${SISTEMA}`, session.token).catch(() => []),
  ])

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Link href="/dashboard/exportacoes/folha" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-2">
          <ArrowLeft className="h-3 w-3" />
          Voltar
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Configuração — {SISTEMA}</h1>
        <p className="text-gray-500 text-sm mt-1">
          Cadastre o código da empresa e o mapeamento de-para dos eventos
        </p>
      </div>

      <ConfiguracaoForm
        sistema={SISTEMA}
        codigoEmpresaInicial={config?.codigo_empresa ?? ''}
        eventos={sistemas.eventos}
        mapeamentos={mapeamentos}
      />
    </div>
  )
}
