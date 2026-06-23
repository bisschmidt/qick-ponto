'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, Save, CheckCircle2 } from 'lucide-react'
import { salvarConfigAction, salvarMapeamentoAction } from './actions'

const ROTULOS_EVENTO: Record<string, string> = {
  HE_50:             'Hora extra 50%',
  HE_100:            'Hora extra 100% (DSR/feriado)',
  ADICIONAL_NOTURNO: 'Adicional noturno',
  FALTA:             'Falta injustificada',
  FALTA_DSR:         'DSR descontado por falta',
  ATRASO:            'Atrasos / saídas antecipadas',
  HORA_REDUZIDA:     'Hora noturna reduzida',
}

interface Mapeamento { evento: string; codigo_externo: string }

export function ConfiguracaoForm({
  sistema,
  codigoEmpresaInicial,
  eventos,
  mapeamentos,
}: {
  sistema: string
  codigoEmpresaInicial: string
  eventos: string[]
  mapeamentos: Mapeamento[]
}) {
  const router = useRouter()
  const [codigoEmpresa, setCodigoEmpresa] = useState(codigoEmpresaInicial)

  const mapaInicial: Record<string, string> = {}
  for (const e of eventos) mapaInicial[e] = ''
  for (const m of mapeamentos) mapaInicial[m.evento] = m.codigo_externo
  const [codigos, setCodigos] = useState<Record<string, string>>(mapaInicial)

  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function salvar() {
    setErro(null)
    if (!codigoEmpresa.trim()) {
      setErro('Informe o código da empresa em ' + sistema)
      return
    }
    startTransition(async () => {
      const r1 = await salvarConfigAction({ sistema, codigo_empresa: codigoEmpresa.trim() })
      if (!r1.ok) {
        setErro(r1.error)
        return
      }
      for (const evento of eventos) {
        const codigo = (codigos[evento] ?? '').trim()
        if (!codigo) continue
        const r = await salvarMapeamentoAction({ sistema, evento, codigo_externo: codigo })
        if (!r.ok) {
          setErro(r.error)
          return
        }
      }
      setSavedAt(Date.now())
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6 space-y-4">
          <h2 className="font-semibold">Empresa em {sistema}</h2>
          <div className="space-y-1.5 max-w-xs">
            <label className="text-sm text-gray-700">Código da empresa</label>
            <Input
              value={codigoEmpresa}
              onChange={(e) => setCodigoEmpresa(e.target.value)}
              placeholder="ex.: 0001"
              maxLength={20}
            />
            <p className="text-xs text-gray-500">
              No Questor, o código fica na primeira coluna do arquivo gerado (4 dígitos).
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div>
            <h2 className="font-semibold">Mapeamento de eventos</h2>
            <p className="text-xs text-gray-500 mt-1">
              Cada evento do Qick Ponto precisa ter um código equivalente em {sistema}. Se um evento
              não acontecer no período, o código pode ficar vazio.
            </p>
          </div>
          <div className="space-y-2">
            {eventos.map((ev) => (
              <div key={ev} className="grid grid-cols-[1fr_180px] gap-3 items-center py-2 border-b last:border-0">
                <div>
                  <p className="text-sm font-medium text-gray-800">{ROTULOS_EVENTO[ev] ?? ev}</p>
                  <p className="text-xs font-mono text-gray-400">{ev}</p>
                </div>
                <Input
                  value={codigos[ev] ?? ''}
                  onChange={(e) => setCodigos((prev) => ({ ...prev, [ev]: e.target.value }))}
                  placeholder="código em "
                  maxLength={20}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      <div className="flex items-center gap-3">
        <Button onClick={salvar} disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar configuração
        </Button>
        {savedAt && (
          <span className="text-sm text-green-600 flex items-center gap-1">
            <CheckCircle2 className="h-4 w-4" />
            Salvo
          </span>
        )}
      </div>
    </div>
  )
}
