import { requireSession } from '@/lib/session'
import { api } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FileText, Download } from 'lucide-react'
import { fmtDataCurta } from '@/lib/utils'

interface Espelho {
  id: string
  status: string
  assinado_at: string | null
  periodo: { data_inicio: string; data_fim: string }
}

const STATUS_LABEL: Record<string, { label: string; variant: 'success' | 'warning' | 'secondary' }> = {
  PENDENTE:          { label: 'Aguardando assinatura', variant: 'warning' },
  ASSINADO_COLAB:    { label: 'Assinado', variant: 'success' },
  NAO_MANIFESTADO:   { label: 'Não manifestado', variant: 'secondary' },
}

export default async function MeusEspelhosPage() {
  const session = await requireSession()
  const lista = await api.get<Espelho[]>('/v1/espelhos/meus', session.token).catch(() => [])

  return (
    <div className="max-w-3xl mx-auto space-y-3">
      <h2 className="text-lg font-semibold text-gray-700">Meus espelhos de ponto</h2>

      {lista.length === 0 ? (
        <Card>
          <CardContent className="py-10 flex flex-col items-center text-gray-400">
            <FileText className="h-10 w-10 mb-2 opacity-40" />
            <p>Nenhum espelho disponível</p>
            <p className="text-xs mt-1">Os espelhos aparecem aqui quando o RH fechar o período</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {lista.map((e) => {
            const s = STATUS_LABEL[e.status] ?? { label: e.status, variant: 'secondary' as const }
            return (
              <Card key={e.id}>
                <CardContent className="py-4 flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <p className="font-medium text-gray-900">
                      {fmtDataCurta(e.periodo.data_inicio)} a {fmtDataCurta(e.periodo.data_fim)}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={s.variant}>{s.label}</Badge>
                      {e.assinado_at && (
                        <span className="text-xs text-gray-500">em {fmtDataCurta(e.assinado_at)}</span>
                      )}
                    </div>
                  </div>
                  <a
                    href={`/api/espelho?id=${e.id}`}
                    target="_blank"
                    className="flex items-center gap-1 text-gray-900 hover:text-black text-sm font-medium"
                  >
                    <Download className="h-4 w-4" />
                    PDF
                  </a>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
