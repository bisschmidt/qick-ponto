'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, FileDown, AlertTriangle } from 'lucide-react'
import { validarFolhaAction } from './actions'

interface CnpjEstab { id: string; cnpj: string; razao_social: string }

interface Pendencia {
  tipo: 'EVENTO_SEM_CODIGO' | 'COLAB_SEM_CODIGO' | 'EMPRESA_SEM_CODIGO' | 'PERIODO_NAO_FECHADO'
  descricao: string
  refId?: string
}

const ROTULO_TIPO: Record<string, string> = {
  PERIODO_NAO_FECHADO: 'Período não fechado',
  EMPRESA_SEM_CODIGO:  'Empresa sem código',
  EVENTO_SEM_CODIGO:   'Evento sem código',
  COLAB_SEM_CODIGO:    'Colaborador sem código',
}

export function GerarFolhaForm({ sistema, estabs }: { sistema: string; estabs: CnpjEstab[] }) {
  const [cnpjEstabId, setCnpjEstabId] = useState(estabs[0]?.id ?? '')
  const [competenciaIni, setCompetenciaIni] = useState('2026-06-01')
  const [competenciaFim, setCompetenciaFim] = useState('2026-06-20')
  const [pendencias, setPendencias] = useState<Pendencia[] | null>(null)
  const [pending, startTransition] = useTransition()

  function validarEGerar(apenasValidar: boolean) {
    if (!cnpjEstabId) return
    setPendencias(null)
    startTransition(async () => {
      const res = await validarFolhaAction({
        sistema,
        cnpj_estab_id: cnpjEstabId,
        competencia_ini: competenciaIni,
        competencia_fim: competenciaFim,
      })
      if (!res.ok) {
        setPendencias([{ tipo: 'EMPRESA_SEM_CODIGO', descricao: res.error }])
        return
      }
      if (!res.data.ok) {
        setPendencias(res.data.pendencias as Pendencia[])
        return
      }
      // Validado — dispara download direto
      if (!apenasValidar) {
        const url = `/api/exportacao-folha/gerar?sistema=${sistema}&cnpj_estab_id=${cnpjEstabId}&competencia_ini=${competenciaIni}&competencia_fim=${competenciaFim}`
        window.open(url, '_blank')
        setPendencias([])
      } else {
        setPendencias([])
      }
    })
  }

  return (
    <div className="space-y-5">
      <div className="grid sm:grid-cols-4 gap-4">
        <div className="space-y-1.5 sm:col-span-2">
          <label className="text-sm font-medium text-gray-700">Estabelecimento (CNPJ)</label>
          <select
            value={cnpjEstabId}
            onChange={(e) => setCnpjEstabId(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">Selecione...</option>
            {estabs.map((e) => (
              <option key={e.id} value={e.id}>{e.razao_social} — {e.cnpj}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700">Início competência</label>
          <Input type="date" value={competenciaIni} onChange={(e) => setCompetenciaIni(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700">Fim competência</label>
          <Input type="date" value={competenciaFim} onChange={(e) => setCompetenciaFim(e.target.value)} />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button variant="secondary" onClick={() => validarEGerar(true)} disabled={pending || !cnpjEstabId}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Validar
        </Button>
        <Button onClick={() => validarEGerar(false)} disabled={pending || !cnpjEstabId}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
          Validar e gerar arquivo
        </Button>
      </div>

      {pendencias !== null && pendencias.length === 0 && (
        <div className="p-3 rounded-md bg-green-50 text-green-700 text-sm">
          Tudo certo — sem pendências. O download começou em uma nova aba.
        </div>
      )}

      {pendencias !== null && pendencias.length > 0 && (
        <div className="p-4 rounded-md border border-amber-200 bg-amber-50 space-y-2">
          <div className="flex items-center gap-2 text-amber-800 font-medium">
            <AlertTriangle className="h-4 w-4" />
            {pendencias.length} pendência(s) bloqueando a exportação
          </div>
          <ul className="text-sm text-amber-900 space-y-1 pl-6 list-disc">
            {pendencias.map((p, i) => (
              <li key={i}>
                <span className="font-mono text-xs text-amber-700">[{ROTULO_TIPO[p.tipo] ?? p.tipo}]</span>{' '}
                {p.descricao}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
