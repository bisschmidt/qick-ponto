'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Plus, Trash2, Calendar, Loader2 } from 'lucide-react'
import { fmtDataCurta } from '@/lib/utils'
import { criarFeriadoAction, removerFeriadoAction } from './actions'

interface Feriado {
  id: string
  nome: string
  tipo: string
  uf: string | null
  municipio: string | null
  data_inicio: string
  data_fim: string
}

export function FeriadosClient({ ano, lista }: { ano: string; lista: Feriado[] }) {
  const router = useRouter()
  const [aberto, setAberto] = useState(false)
  const [nome, setNome] = useState('')
  const [tipo, setTipo] = useState('NACIONAL')
  const [uf, setUf] = useState('')
  const [municipio, setMunicipio] = useState('')
  const [dataInicio, setDataInicio] = useState(`${ano}-01-01`)
  const [dataFim, setDataFim] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function salvar() {
    setErro(null)
    if (nome.trim().length < 2) { setErro('Nome muito curto'); return }
    startTransition(async () => {
      const r = await criarFeriadoAction({
        nome: nome.trim(),
        tipo,
        uf: tipo === 'ESTADUAL' || tipo === 'MUNICIPAL' ? uf : null,
        municipio: tipo === 'MUNICIPAL' ? municipio : null,
        data_inicio: dataInicio,
        data_fim: dataFim || dataInicio,
      })
      if (!r.ok) { setErro(r.error); return }
      setAberto(false)
      setNome(''); setMunicipio(''); setUf('')
      router.refresh()
    })
  }

  function remover(id: string) {
    if (!confirm('Remover este feriado?')) return
    startTransition(async () => {
      await removerFeriadoAction(id)
      router.refresh()
    })
  }

  return (
    <div className="space-y-5 max-w-4xl">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Feriados</h1>
          <p className="text-sm text-gray-500 mt-1">Cadastro de feriados que afetam o cálculo do ponto</p>
        </div>
        <div className="flex gap-2 items-end">
          <div className="space-y-1">
            <label className="text-xs text-gray-500">Ano</label>
            <select
              value={ano}
              onChange={(e) => router.push(`/dashboard/feriados?ano=${e.target.value}`)}
              className="flex h-10 rounded-md border bg-background px-3 py-2 text-sm"
            >
              {[2024, 2025, 2026, 2027, 2028].map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <Button onClick={() => setAberto(!aberto)}>
            <Plus className="h-4 w-4" /> Novo feriado
          </Button>
        </div>
      </div>

      {aberto && (
        <Card>
          <CardContent className="pt-5 space-y-3">
            <h2 className="font-semibold text-gray-700">Cadastrar feriado</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-gray-500">Nome</label>
                <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Natal" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-gray-500">Tipo</label>
                <select value={tipo} onChange={(e) => setTipo(e.target.value)}
                  className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm">
                  <option value="NACIONAL">Nacional</option>
                  <option value="ESTADUAL">Estadual</option>
                  <option value="MUNICIPAL">Municipal</option>
                  <option value="FACULTATIVO">Facultativo</option>
                </select>
              </div>
              {(tipo === 'ESTADUAL' || tipo === 'MUNICIPAL') && (
                <div className="space-y-1">
                  <label className="text-xs text-gray-500">UF</label>
                  <Input value={uf} onChange={(e) => setUf(e.target.value.toUpperCase().slice(0, 2))} placeholder="SP" />
                </div>
              )}
              {tipo === 'MUNICIPAL' && (
                <div className="space-y-1">
                  <label className="text-xs text-gray-500">Município</label>
                  <Input value={municipio} onChange={(e) => setMunicipio(e.target.value)} placeholder="Florianópolis" />
                </div>
              )}
              <div className="space-y-1">
                <label className="text-xs text-gray-500">Data início</label>
                <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-gray-500">Data fim (opcional, para feriado prolongado)</label>
                <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
              </div>
            </div>
            {erro && <p className="text-sm text-red-600">{erro}</p>}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setAberto(false)} disabled={pending}>Cancelar</Button>
              <Button onClick={salvar} disabled={pending}>
                {pending && <Loader2 className="h-4 w-4 animate-spin" />} Salvar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {lista.length === 0 ? (
            <div className="py-10 flex flex-col items-center text-gray-400 text-sm">
              <Calendar className="h-10 w-10 mb-2 opacity-40" />
              Nenhum feriado em {ano}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs text-gray-500 uppercase">
                <tr className="border-b bg-gray-50">
                  <th className="text-left px-3 py-2 font-medium">Data</th>
                  <th className="text-left px-3 py-2 font-medium">Nome</th>
                  <th className="text-left px-3 py-2 font-medium">Tipo</th>
                  <th className="text-left px-3 py-2 font-medium">Local</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {lista.map((f) => (
                  <tr key={f.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-3 py-2.5 font-mono text-xs">
                      {fmtDataCurta(f.data_inicio)}
                      {f.data_fim !== f.data_inicio && ` – ${fmtDataCurta(f.data_fim)}`}
                    </td>
                    <td className="px-3 py-2.5 font-medium">{f.nome}</td>
                    <td className="px-3 py-2.5"><Badge variant="secondary">{f.tipo}</Badge></td>
                    <td className="px-3 py-2.5 text-xs text-gray-500">
                      {f.tipo === 'NACIONAL' ? 'Nacional' : [f.uf, f.municipio].filter(Boolean).join(' / ')}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <button onClick={() => remover(f.id)} className="text-red-500 hover:text-red-700" disabled={pending}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
