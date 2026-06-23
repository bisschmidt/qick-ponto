import { requireSession } from '@/lib/session'
import { getProximoEvento, getMinhasHeHoje } from './actions'
import { PontoClient } from './ponto-client'

export default async function PontoPage() {
  const session = await requireSession()
  const [evento, hesHoje] = await Promise.all([
    getProximoEvento().catch(() => null),
    getMinhasHeHoje(),
  ])

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <PontoClient
        nomeColaborador={session.nome}
        proximoEvento={evento}
        temHeHoje={hesHoje.length > 0}
      />
    </div>
  )
}
