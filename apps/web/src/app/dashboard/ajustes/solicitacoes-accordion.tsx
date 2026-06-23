'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ChevronDown, ChevronRight, Edit3, FileText, ExternalLink } from 'lucide-react'
import { fmtDataCurta } from '@/lib/utils'
import { AjusteAcoes } from './ajuste-acoes'

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
}

const STATUS_BADGE: Record<string, { label: string; variant: 'warning' | 'success' | 'destructive' | 'secondary' }> = {
  PENDENTE_GESTOR:  { label: 'Aguardando Gestor', variant: 'warning' },
  APROVADO_GESTOR:  { label: 'Aprovado Gestor',    variant: 'success' },
  PENDENTE_RH:      { label: 'Aguardando RH',      variant: 'warning' },
  APROVADO_RH:      { label: 'Aprovado',           variant: 'success' },
  REPROVADO_GESTOR: { label: 'Reprovado Gestor',   variant: 'destructive' },
  REPROVADO_RH:     { label: 'Reprovado RH',       variant: 'destructive' },
}

const TIPO_LABEL: Record<string, string> = {
  ENTRADA: 'Entrada', SAIDA: 'Saída',
  SAIDA_PAUSA_NR17: 'Saída pausa NR-17', RETORNO_PAUSA_NR17: 'Retorno pausa NR-17',
  SAIDA_INTERVALO: 'Saída de intervalo', RETORNO_INTERVALO: 'Retorno de intervalo',
}

function horaDeIso(iso: string): string {
  const d = new Date(iso)
  const brt = new Date(d.getTime() - 3 * 3600 * 1000)
  return `${String(brt.getUTCHours()).padStart(2, '0')}:${String(brt.getUTCMinutes()).padStart(2, '0')}`
}

interface Grupo {
  colab: { id: string; nome_completo: string; matricula: string }
  itens: Ajuste[]
}

function GrupoColaborador({ grupo, role }: { grupo: Grupo; role: string }) {
  const [aberto, setAberto] = useState(false)
  const mes = grupo.itens[0]?.data_ponto?.slice(0, 7) ?? ''

  return (
    <Card>
      <CardContent className="p-0">
        {/* Linha do colaborador — clicável para expandir */}
        <button
          onClick={() => setAberto((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors text-left"
        >
          <div className="flex items-center gap-3 min-w-0">
            {aberto
              ? <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
              : <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />
            }
            <div className="min-w-0">
              <span className="font-semibold text-gray-900">{grupo.colab.nome_completo}</span>
              <span className="text-gray-400 text-sm font-mono ml-2">{grupo.colab.matricula}</span>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0 ml-3">
            <Badge variant="secondary">{grupo.itens.length} solicitação(ões)</Badge>
            <Link
              href={`/dashboard/equipe/colaborador/${grupo.colab.id}${mes ? `?mes=${mes}` : ''}`}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline"
            >
              Ver ficha <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        </button>

        {/* Pedidos expandidos */}
        {aberto && (
          <div className="border-t divide-y bg-gray-50/50">
            {grupo.itens.map((a) => {
              const s = STATUS_BADGE[a.status] ?? { label: a.status, variant: 'secondary' as const }
              return (
                <div key={a.id} className="px-4 py-3 hover:bg-white transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {a.tipo_ajuste === 'ATESTADO'
                          ? <FileText className="h-4 w-4 text-green-600 shrink-0" />
                          : <Edit3 className="h-4 w-4 text-blue-600 shrink-0" />
                        }
                        <Badge variant={s.variant}>{s.label}</Badge>
                        <span className="text-xs text-gray-400 font-mono">{fmtDataCurta(a.data_ponto)}</span>
                      </div>
                      <p className="text-sm text-gray-700 font-medium">{a.motivo.descricao}</p>
                      {a.novo_tipo && a.novo_timestamp && (
                        <p className="text-xs bg-blue-50 text-blue-800 rounded px-2 py-1 inline-block">
                          Pedido: <strong>{TIPO_LABEL[a.novo_tipo] ?? a.novo_tipo}</strong> às <strong>{horaDeIso(a.novo_timestamp)}</strong>
                        </p>
                      )}
                      <p className="text-sm text-gray-500 italic">"{a.justificativa}"</p>
                    </div>
                    <AjusteAcoes ajusteId={a.id} status={a.status} role={role} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function SolicitacoesAccordion({ pendentes, role }: { pendentes: Ajuste[]; role: string }) {
  if (pendentes.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 flex flex-col items-center text-gray-400 text-sm">
          <span className="text-3xl mb-2">✓</span>
          Nenhuma solicitação aguardando aprovação
        </CardContent>
      </Card>
    )
  }

  // Agrupa por colaborador mantendo a ordem de chegada
  const ordem: string[] = []
  const grupos: Record<string, Grupo> = {}
  for (const a of pendentes) {
    if (!grupos[a.colaborador.id]) {
      grupos[a.colaborador.id] = { colab: a.colaborador, itens: [] }
      ordem.push(a.colaborador.id)
    }
    grupos[a.colaborador.id]!.itens.push(a)
  }

  return (
    <div className="space-y-2">
      {ordem.map((id) => (
        <GrupoColaborador key={id} grupo={grupos[id]!} role={role} />
      ))}
    </div>
  )
}
