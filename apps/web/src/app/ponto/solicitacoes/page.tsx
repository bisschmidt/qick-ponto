import { requireSession } from '@/lib/session'
import { api } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Clock, CheckCircle2, XCircle, FileText, Edit3 } from 'lucide-react'
import { fmtDataCurta } from '@/lib/utils'

interface Solicitacao {
  id: string
  status: string
  motivo: { descricao: string }
  data_ponto: string
  tipo_ajuste: string
  justificativa: string
  created_at: string
  rh_obs: string | null
  gestor_obs: string | null
  novo_timestamp: string | null
  novo_tipo: string | null
}

const STATUS_VIS: Record<string, { label: string; variant: 'success' | 'warning' | 'destructive' | 'secondary'; icon: typeof Clock }> = {
  PENDENTE_GESTOR:  { label: 'Aguardando gestor', variant: 'warning', icon: Clock },
  APROVADO_GESTOR:  { label: 'Aprovado pelo gestor', variant: 'success', icon: CheckCircle2 },
  REPROVADO_GESTOR: { label: 'Reprovado pelo gestor', variant: 'destructive', icon: XCircle },
  PENDENTE_RH:      { label: 'Aguardando RH', variant: 'warning', icon: Clock },
  APROVADO_RH:      { label: 'Aprovado', variant: 'success', icon: CheckCircle2 },
  REPROVADO_RH:     { label: 'Reprovado', variant: 'destructive', icon: XCircle },
}

const TIPO_LABEL: Record<string, string> = {
  ENTRADA: 'Entrada',
  SAIDA: 'Saída',
  SAIDA_PAUSA_NR17: 'Saída pausa NR-17',
  RETORNO_PAUSA_NR17: 'Retorno pausa NR-17',
  SAIDA_INTERVALO: 'Saída de intervalo',
  RETORNO_INTERVALO: 'Retorno de intervalo',
}

function horaDeIso(iso: string): string {
  const d = new Date(iso)
  const brt = new Date(d.getTime() - 3 * 3600 * 1000)
  return `${String(brt.getUTCHours()).padStart(2, '0')}:${String(brt.getUTCMinutes()).padStart(2, '0')}`
}

export default async function MinhasSolicitacoesPage() {
  const session = await requireSession()
  const lista = await api.get<Solicitacao[]>('/v1/ponto/minhas-solicitacoes', session.token).catch(() => [])

  return (
    <div className="max-w-3xl mx-auto space-y-3">
      <h2 className="text-lg font-semibold text-gray-700">Minhas solicitações</h2>

      {lista.length === 0 ? (
        <Card>
          <CardContent className="py-10 flex flex-col items-center text-gray-400">
            <FileText className="h-10 w-10 mb-2 opacity-40" />
            <p>Você ainda não enviou nenhuma solicitação</p>
            <p className="text-xs mt-1">Use a ficha ponto para solicitar ajustes ou enviar atestados</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {lista.map((s) => {
            const v = STATUS_VIS[s.status] ?? { label: s.status, variant: 'secondary' as const, icon: Clock }
            const Icon = v.icon
            const isAtestado = s.tipo_ajuste === 'ATESTADO'
            return (
              <Card key={s.id}>
                <CardContent className="py-4 space-y-2">
                  <div className="flex items-start justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {isAtestado
                        ? <FileText className="h-4 w-4 text-green-600" />
                        : <Edit3 className="h-4 w-4 text-blue-600" />
                      }
                      <p className="font-medium text-gray-900">
                        {isAtestado ? 'Atestado médico' : s.motivo.descricao}
                      </p>
                      <Badge variant={v.variant}>
                        <Icon className="h-3 w-3 mr-1" />
                        {v.label}
                      </Badge>
                    </div>
                    <span className="text-xs text-gray-400 font-mono">{fmtDataCurta(s.data_ponto)}</span>
                  </div>

                  {/* Detalhes do ajuste pedido */}
                  {!isAtestado && s.novo_tipo && s.novo_timestamp && (
                    <div className="text-xs bg-blue-50 rounded px-3 py-1.5 text-blue-800">
                      Pedido: <strong>{TIPO_LABEL[s.novo_tipo] ?? s.novo_tipo}</strong> às <strong>{horaDeIso(s.novo_timestamp)}</strong>
                    </div>
                  )}

                  <p className="text-sm text-gray-600 italic">"{s.justificativa}"</p>

                  {(s.gestor_obs || s.rh_obs) && (
                    <div className="text-xs text-gray-600 bg-gray-50 rounded px-3 py-2 space-y-0.5 border">
                      {s.gestor_obs && <p><span className="font-medium">Gestor:</span> {s.gestor_obs}</p>}
                      {s.rh_obs && <p><span className="font-medium">RH:</span> {s.rh_obs}</p>}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
