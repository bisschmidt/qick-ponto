'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, CheckCircle2, Loader2, UserX } from 'lucide-react'
import { fmtDataCurta } from '@/lib/utils'
import { justificarFaltaAction } from './actions'

interface Item {
  colaborador_id: string
  colaborador_nome: string
  colaborador_matricula: string
  data: string
  descricoes: string[]
  ja_justificado: boolean
  motivo_justificado: string | null
}

interface Motivo { id: string; descricao: string }

export function InconsistenciasSection({
  inicio,
  fim,
  inconsistencias,
  faltas,
  jaJustificadas,
  motivos,
}: {
  inicio: string
  fim: string
  inconsistencias: Item[]
  faltas: Item[]
  jaJustificadas: Item[]
  motivos: Motivo[]
}) {
  const router = useRouter()

  function aplicarFiltro(form: FormData) {
    const novoInicio = form.get('inicio') as string
    const novoFim    = form.get('fim') as string
    router.push(`/dashboard/ajustes?inicio=${novoInicio}&fim=${novoFim}`)
  }

  return (
    <>
      <Card>
        <CardContent className="pt-6">
          <form action={aplicarFiltro} className="flex items-end gap-3 flex-wrap">
            <div className="space-y-1">
              <label className="text-xs text-gray-500">Início</label>
              <Input name="inicio" type="date" defaultValue={inicio} required />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-gray-500">Fim</label>
              <Input name="fim" type="date" defaultValue={fim} required />
            </div>
            <Button type="submit" variant="secondary">Aplicar período</Button>
          </form>
        </CardContent>
      </Card>

      <ListaItens
        titulo={`Inconsistências de marcação (${inconsistencias.length} pendente${inconsistencias.length === 1 ? '' : 's'})`}
        descricao="Problemas no ponto que impedem o fechamento — precisam ser corrigidos"
        icone={<AlertTriangle className="h-5 w-5 text-red-500" />}
        itens={inconsistencias}
        motivos={motivos}
        emptyMsg="Nenhuma inconsistência de marcação"
        emptyVerde
        labelBotao="Corrigir"
      />

      <ListaItens
        titulo={`Faltas do período (${faltas.length})`}
        descricao="Faltas registradas — opcional justificar com atestado/abono. Sem ajuste, contam como falta injustificada"
        icone={<UserX className="h-5 w-5 text-gray-500" />}
        itens={faltas}
        motivos={motivos}
        emptyMsg="Sem faltas no período"
        labelBotao="Justificar (opcional)"
      />

      {jaJustificadas.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700 px-4">
            Ver {jaJustificadas.length} dia(s) já justificado(s)
          </summary>
          <Card className="mt-2">
            <CardContent className="p-0">
              <div className="divide-y">
                {jaJustificadas.map((item) => (
                  <div key={`${item.colaborador_id}-${item.data}-just`} className="p-3 bg-green-50/50">
                    <div className="flex items-center gap-2 text-sm flex-wrap">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span className="font-mono text-xs text-gray-400">{item.colaborador_matricula}</span>
                      <span className="font-medium">{item.colaborador_nome}</span>
                      <Badge variant="success">{fmtDataCurta(item.data)}</Badge>
                      <span className="text-gray-500">— {item.motivo_justificado}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </details>
      )}
    </>
  )
}

function ListaItens({
  titulo, descricao, icone, itens, motivos, emptyMsg, emptyVerde, labelBotao,
}: {
  titulo: string
  descricao: string
  icone: React.ReactNode
  itens: Item[]
  motivos: Motivo[]
  emptyMsg: string
  emptyVerde?: boolean
  labelBotao: string
}) {
  const router = useRouter()
  const [abertoKey, setAbertoKey] = useState<string | null>(null)
  const [motivoId, setMotivoId] = useState('')
  const [justif, setJustif] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function justificar(item: Item) {
    setErro(null)
    if (!motivoId) { setErro('Selecione um motivo'); return }
    if (justif.trim().length < 3) { setErro('Justificativa muito curta'); return }
    startTransition(async () => {
      const res = await justificarFaltaAction({
        colaborador_id: item.colaborador_id,
        motivo_id: motivoId,
        data_ponto: item.data,
        justificativa: justif.trim(),
      })
      if (!res.ok) { setErro(res.error); return }
      setAbertoKey(null)
      setMotivoId('')
      setJustif('')
      router.refresh()
    })
  }

  return (
    <section className="space-y-2">
      <div className="flex items-start gap-3">
        {icone}
        <div>
          <h2 className="text-lg font-semibold text-gray-700">{titulo}</h2>
          <p className="text-xs text-gray-500">{descricao}</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {itens.length === 0 ? (
            <div className={`flex flex-col items-center justify-center py-6 text-sm ${emptyVerde ? 'text-green-600' : 'text-gray-400'}`}>
              {emptyVerde && <CheckCircle2 className="h-8 w-8 mb-2" />}
              {emptyMsg}
            </div>
          ) : (
            <div className="divide-y">
              {itens.map((item) => {
                const key = `${item.colaborador_id}-${item.data}`
                return (
                  <div key={key} className="p-3">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs text-gray-400">{item.colaborador_matricula}</span>
                          <span className="font-medium">{item.colaborador_nome}</span>
                          <Badge variant="warning">{fmtDataCurta(item.data)}</Badge>
                        </div>
                        {item.descricoes.length > 0 && (
                          <ul className="text-sm text-amber-700 list-disc pl-5">
                            {item.descricoes.map((d, k) => <li key={k}>{d}</li>)}
                          </ul>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant={emptyVerde ? 'default' : 'secondary'}
                        onClick={() => setAbertoKey(abertoKey === key ? null : key)}
                      >
                        {abertoKey === key ? 'Cancelar' : labelBotao}
                      </Button>
                    </div>

                    {abertoKey === key && (
                      <div className="mt-3 p-3 bg-gray-50 rounded-md space-y-3">
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-gray-700">Motivo</label>
                          <select
                            value={motivoId}
                            onChange={(e) => setMotivoId(e.target.value)}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          >
                            <option value="">Selecione…</option>
                            {motivos.map((m) => (
                              <option key={m.id} value={m.id}>{m.descricao}</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-gray-700">Justificativa</label>
                          <textarea
                            value={justif}
                            onChange={(e) => setJustif(e.target.value)}
                            rows={2}
                            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            placeholder="Ex: Apresentou atestado médico de 1 dia"
                          />
                        </div>
                        {erro && <p className="text-sm text-red-600">{erro}</p>}
                        <Button onClick={() => justificar(item)} disabled={pending}>
                          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                          Aprovar justificativa
                        </Button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
