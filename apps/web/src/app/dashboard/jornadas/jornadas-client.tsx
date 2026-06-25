'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Clock, MoreVertical, Power, PowerOff, Trash2, Loader2 } from 'lucide-react'
import { inativarJornadaAction, excluirJornadaAction } from './actions'

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export interface JornadaGestao {
  id: string
  nome: string
  tipo: string
  ativo: boolean
  hora_inicio: string
  hora_fim: string
  dias_semana: number[]
  horarios?: { dia_semana: number; hora_inicio: string; hora_fim: string }[]
  _count?: { colaboradores: number }
}

export function JornadasClient({ jornadas, podeEditar }: { jornadas: JornadaGestao[]; podeEditar: boolean }) {
  const [erro, setErro] = useState<string | null>(null)

  if (jornadas.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-gray-400">
          <Clock className="h-12 w-12 mb-3 opacity-30" />
          <p>Nenhuma jornada cadastrada</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {erro && <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{erro}</div>}
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-500">Nome</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Tipo</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Horário</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Dias</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Vínculos</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {jornadas.map((j) => (
                <tr key={j.id} className={`border-b last:border-0 hover:bg-blue-50/50 ${!j.ativo ? 'opacity-60' : ''}`}>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    <div className="flex items-center gap-2">
                      <Link href={`/dashboard/jornadas/${j.id}`} className="hover:text-blue-700">{j.nome}</Link>
                      {!j.ativo && <Badge variant="secondary">Inativa</Badge>}
                      {j.horarios && j.horarios.length > 0 && <Badge variant="outline" className="text-xs">Horário por dia</Badge>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{j.tipo.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-3 font-mono text-gray-700">{j.hora_inicio} – {j.hora_fim}</td>
                  <td className="px-4 py-3 text-gray-500">{[...j.dias_semana].sort((a, b) => a - b).map((d) => DIAS[d]).join(', ')}</td>
                  <td className="px-4 py-3 text-gray-500">{j._count?.colaboradores ?? 0}</td>
                  <td className="px-4 py-3 text-right">
                    {podeEditar && (
                      <AcoesJornada
                        jornada={j}
                        onErro={setErro}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}

function AcoesJornada({ jornada, onErro }: { jornada: JornadaGestao; onErro: (e: string | null) => void }) {
  const [aberto, setAberto] = useState(false)
  const [pending, startTransition] = useTransition()
  const vinculos = jornada._count?.colaboradores ?? 0
  const podeExcluir = vinculos === 0

  function inativar() {
    setAberto(false); onErro(null)
    startTransition(async () => {
      const r = await inativarJornadaAction(jornada.id, !jornada.ativo)
      if (!r.ok) onErro(r.error)
    })
  }

  function excluir() {
    setAberto(false); onErro(null)
    if (!confirm(`Excluir a jornada "${jornada.nome}"? Esta ação não pode ser desfeita.`)) return
    startTransition(async () => {
      const r = await excluirJornadaAction(jornada.id)
      if (!r.ok) onErro(r.error)
    })
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        disabled={pending}
        className="p-1.5 rounded hover:bg-gray-100 text-gray-500"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreVertical className="h-4 w-4" />}
      </button>
      {aberto && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setAberto(false)} />
          <div className="absolute right-0 z-20 mt-1 w-52 rounded-md border bg-white shadow-lg py-1 text-sm">
            <Link
              href={`/dashboard/jornadas/${jornada.id}`}
              className="block px-3 py-2 hover:bg-gray-50 text-gray-700"
              onClick={() => setAberto(false)}
            >
              Editar
            </Link>
            <button
              type="button"
              onClick={inativar}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-gray-700 text-left"
            >
              {jornada.ativo ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
              {jornada.ativo ? 'Inativar' : 'Reativar'}
            </button>
            <button
              type="button"
              onClick={excluir}
              disabled={!podeExcluir}
              title={podeExcluir ? undefined : 'Jornada já usada por colaboradores — só pode inativar'}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-red-50 text-red-600 text-left disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
            >
              <Trash2 className="h-4 w-4" />
              Excluir
            </button>
            {!podeExcluir && (
              <p className="px-3 py-1.5 text-xs text-gray-400">
                Usada por {vinculos} colaborador(es). Só é possível inativar.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
