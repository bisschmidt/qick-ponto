'use client'

import { useActionState } from 'react'
import { rodarApuracaoAction, rodarApuracaoLoteAction, type ApuracaoState, type ApuracaoLoteState } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2, CheckCircle2, Play, AlertTriangle, Clock, TrendingUp, UserX, Timer, Users } from 'lucide-react'
import { fmtMinutos } from '@/lib/utils'

interface Colaborador { id: string; nome_completo: string; matricula: string }

export function ApuracaoForm({ colaboradores }: { colaboradores: Colaborador[] }) {
  const [state, action, isPending] = useActionState<ApuracaoState, FormData>(rodarApuracaoAction, undefined)
  const [loteState, loteAction, lotePending] = useActionState<ApuracaoLoteState, FormData>(rodarApuracaoLoteAction, undefined)

  const defaultInicio = '2026-06-01'
  const defaultFim    = '2026-06-20'

  return (
    <Card>
      <CardContent className="pt-6 space-y-6">
        <div className="border-b pb-6">
          <h2 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <Users className="h-4 w-4" />
            Apurar todo o tenant
          </h2>
          <form action={loteAction} className="flex items-end gap-4 flex-wrap">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Início</label>
              <Input name="data_inicio" type="date" defaultValue={defaultInicio} required />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Fim</label>
              <Input name="data_fim" type="date" defaultValue={defaultFim} required />
            </div>
            <Button type="submit" disabled={lotePending} variant="default">
              {lotePending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
              Apurar todos
            </Button>
            {loteState && !loteState.ok && (
              <p className="text-sm text-red-600">{loteState.error}</p>
            )}
          </form>

          {loteState?.ok && (
            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-2 text-green-700 font-semibold">
                <CheckCircle2 className="h-5 w-5" />
                {loteState.resultado.apurados} de {loteState.resultado.total_colaboradores} colaboradores apurados
                {loteState.resultado.falhas > 0 && (
                  <span className="text-red-600 ml-2">({loteState.resultado.falhas} falha(s))</span>
                )}
              </div>
              <div className="max-h-72 overflow-y-auto border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-left text-xs text-gray-500 uppercase">
                    <tr>
                      <th className="px-3 py-2">Matrícula</th>
                      <th className="px-3 py-2">Colaborador</th>
                      <th className="px-3 py-2 text-right">Dias</th>
                      <th className="px-3 py-2 text-right">Inconsist.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {loteState.resultado.resultados.map((r) => (
                      <tr key={r.colaborador_id}>
                        <td className="px-3 py-2 font-mono text-xs">{r.matricula}</td>
                        <td className="px-3 py-2">{r.nome}</td>
                        <td className="px-3 py-2 text-right">{r.dias_apurados}</td>
                        <td className={`px-3 py-2 text-right ${r.inconsistencias > 0 ? 'text-amber-600 font-medium' : 'text-gray-400'}`}>
                          {r.inconsistencias}
                        </td>
                      </tr>
                    ))}
                    {loteState.resultado.erros.map((e) => (
                      <tr key={e.colaborador_id} className="bg-red-50">
                        <td className="px-3 py-2 font-mono text-xs">{e.matricula}</td>
                        <td className="px-3 py-2">{e.nome}</td>
                        <td colSpan={2} className="px-3 py-2 text-red-700 text-xs">{e.erro}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div>
          <h2 className="font-semibold text-gray-700 mb-4">Apurar um colaborador específico</h2>
          <form action={action} className="flex items-end gap-4 flex-wrap">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Colaborador</label>
              <select
                name="colaborador_id"
                required
                className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-w-[220px]"
              >
                <option value="">Selecione...</option>
                {colaboradores.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome_completo} ({c.matricula})</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Início</label>
              <Input name="data_inicio" type="date" defaultValue={defaultInicio} required />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Fim</label>
              <Input name="data_fim" type="date" defaultValue={defaultFim} required />
            </div>

            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Apurar
            </Button>

            {state && !state.ok && (
              <p className="text-sm text-red-600">{state.error}</p>
            )}
          </form>
        </div>

        {state?.ok && (
          <div className="space-y-4 border-t pt-4">
            <div className="flex items-center gap-2 text-green-700 font-semibold">
              <CheckCircle2 className="h-5 w-5" />
              Apuração concluída — {state.resultado.diasApurados} dia(s) processado(s)
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <StatCard
                icon={<Clock className="h-4 w-4" />}
                label="Horas trabalhadas"
                value={fmtMinutos(state.resultado.minutosTrabalhados)}
                color="text-gray-900"
              />
              <StatCard
                icon={<TrendingUp className="h-4 w-4" />}
                label="HE 50%"
                value={fmtMinutos(state.resultado.minutosHe50)}
                color="text-orange-600"
              />
              <StatCard
                icon={<TrendingUp className="h-4 w-4" />}
                label="HE 100%"
                value={fmtMinutos(state.resultado.minutosHe100)}
                color="text-red-600"
              />
              <StatCard
                icon={<Timer className="h-4 w-4" />}
                label="Atrasos"
                value={fmtMinutos(state.resultado.minutosAtraso)}
                color="text-amber-600"
              />
              <StatCard
                icon={<UserX className="h-4 w-4" />}
                label="Faltas"
                value={String(state.resultado.faltas)}
                color="text-red-600"
              />
            </div>

            {state.resultado.inconsistencias.length > 0 && (
              <div className="space-y-1">
                <p className="text-sm font-medium text-amber-700 flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4" />
                  {state.resultado.inconsistencias.length} inconsistência(s) — precisam ser corrigidas antes de fechar:
                </p>
                <ul className="text-sm text-amber-800 space-y-0.5 pl-5 list-disc max-h-48 overflow-y-auto">
                  {state.resultado.inconsistencias.map((i, idx) => (
                    <li key={idx}>
                      <span className="font-mono">{i.data}</span> — {i.descricao}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function StatCard({
  icon, label, value, color,
}: {
  icon: React.ReactNode
  label: string
  value: string
  color: string
}) {
  return (
    <div className="bg-gray-50 rounded-lg p-3 space-y-1">
      <div className="flex items-center gap-1 text-gray-500 text-xs">
        {icon}
        {label}
      </div>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
    </div>
  )
}
