'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FileText } from 'lucide-react'

interface CnpjEstab { id: string; cnpj: string; razao_social: string }

export function GerarAfdForm({ estabs }: { estabs: CnpjEstab[] }) {
  const now = new Date()
  const [cnpjEstabId, setCnpjEstabId] = useState(estabs[0]?.id ?? '')
  const [dataInicio, setDataInicio] = useState(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10))
  const [dataFim, setDataFim] = useState(new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10))

  const handleDownload = (tipo: 'afd' | 'aej') => {
    if (!cnpjEstabId) return
    const url = `/api/${tipo}?cnpj_estab_id=${cnpjEstabId}&data_inicio=${dataInicio}&data_fim=${dataFim}`
    window.open(url, '_blank')
  }

  return (
    <div className="flex items-end gap-4 flex-wrap">
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">Estabelecimento (CNPJ)</label>
        <select
          value={cnpjEstabId}
          onChange={(e) => setCnpjEstabId(e.target.value)}
          className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-w-[240px]"
        >
          <option value="">Selecione...</option>
          {estabs.map((e) => (
            <option key={e.id} value={e.id}>{e.razao_social} — {e.cnpj}</option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">Início</label>
        <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">Fim</label>
        <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
      </div>
      <Button onClick={() => handleDownload('afd')} disabled={!cnpjEstabId}>
        <FileText className="h-4 w-4" />
        Gerar AFD
      </Button>
      <Button onClick={() => handleDownload('aej')} disabled={!cnpjEstabId} variant="secondary">
        <FileText className="h-4 w-4" />
        Gerar AEJ
      </Button>
    </div>
  )
}
