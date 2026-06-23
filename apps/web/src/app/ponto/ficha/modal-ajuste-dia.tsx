'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { X, Edit3, FileText, Loader2, CheckCircle2 } from 'lucide-react'
import { solicitarAjusteAction, enviarAtestadoAction } from './actions'

const TIPO_LABEL: Record<string, string> = {
  ENTRADA: 'Entrada',
  SAIDA: 'Saída',
  SAIDA_PAUSA_NR17: 'Saída pausa NR-17',
  RETORNO_PAUSA_NR17: 'Retorno pausa NR-17',
  SAIDA_INTERVALO: 'Saída de intervalo',
  RETORNO_INTERVALO: 'Retorno de intervalo',
}

interface Dia {
  data: string
  diaSemana: number
  status: string
  marcacoes: { tipo: string; hora: string; nsr: string }[]
  ajustes: { id: string; status: string; motivo: string }[]
}

// Quando o usuário clica em um slot específico (chip de horário)
interface Slot {
  tipo: string   // ENTRADA, SAIDA, etc
  hora: string   // "08:00"
  nsr: string
}

type Modo = 'menu' | 'ajuste' | 'atestado' | 'sucesso'

export function ModalAjusteDia({
  dia,
  colaboradorId,
  onClose,
  onSucesso,
  slotInicial,
  temMarcacoes = true,
}: {
  dia: Dia
  colaboradorId: string
  onClose: () => void
  onSucesso: () => void
  slotInicial?: Slot
  temMarcacoes?: boolean
}) {
  const modoInicial: Modo = slotInicial ? 'ajuste' : 'menu'
  const [modo, setModo] = useState<Modo>(modoInicial)
  // Para dias sem marcações (FALTA), padrão é ESQUECIMENTO; para slots é CORRIGIR_HORARIO
  const tipoInicial = slotInicial ? 'CORRIGIR_HORARIO' : (temMarcacoes ? 'ESQUECIMENTO' : 'ESQUECIMENTO')
  const [tipoAjuste, setTipoAjuste] = useState(tipoInicial)
  const [novoHorario, setNovoHorario] = useState(slotInicial?.hora ?? '08:00')
  const [novoTipo, setNovoTipo] = useState(slotInicial?.tipo ?? 'ENTRADA')
  const [justificativa, setJustificativa] = useState('')
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [dataInicio, setDataInicio] = useState(dia.data)
  const [dataFim, setDataFim] = useState(dia.data)
  const [erro, setErro] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function enviarAjuste() {
    setErro(null)
    if (justificativa.trim().length < 3) {
      setErro('Descreva o motivo (mínimo 3 caracteres)')
      return
    }
    startTransition(async () => {
      const novoTimestamp =
        tipoAjuste !== 'JUSTIFICAR_FALTA'
          ? new Date(`${dia.data}T${novoHorario}:00-03:00`).toISOString()
          : undefined
      const r = await solicitarAjusteAction({
        colaborador_id: colaboradorId,
        data_ponto: dia.data,
        tipo_ajuste: tipoAjuste,
        novo_timestamp: novoTimestamp,
        novo_tipo: tipoAjuste !== 'JUSTIFICAR_FALTA' ? novoTipo : undefined,
        marcacao_nsr: slotInicial?.nsr,
        justificativa: justificativa.trim(),
      })
      if (!r.ok) { setErro(r.error); return }
      setModo('sucesso')
      setTimeout(onSucesso, 1500)
    })
  }

  function enviarAtestado() {
    setErro(null)
    if (!arquivo) { setErro('Selecione o arquivo do atestado'); return }
    if (arquivo.size > 5 * 1024 * 1024) { setErro('Arquivo maior que 5 MB'); return }
    startTransition(async () => {
      const fd = new FormData()
      fd.append('arquivo', arquivo)
      fd.append('colaborador_id', colaboradorId)
      fd.append('data_inicio', dataInicio)
      fd.append('data_fim', dataFim)
      fd.append('justificativa', justificativa.trim() || 'Atestado médico anexado')
      const r = await enviarAtestadoAction(fd)
      if (!r.ok) { setErro(r.error); return }
      setModo('sucesso')
      setTimeout(onSucesso, 1500)
    })
  }

  const tituloSlot = slotInicial
    ? `Corrigir ${TIPO_LABEL[slotInicial.tipo] ?? slotInicial.tipo} das ${slotInicial.hora}`
    : `Dia ${dia.data.split('-').reverse().join('/')}`

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md">
        <Card>
          <CardContent className="p-0">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <p className="font-semibold text-gray-900">{tituloSlot}</p>
                <p className="text-xs text-gray-500">
                  {slotInicial
                    ? `Horário atual: ${slotInicial.hora}`
                    : `${dia.marcacoes.length} marcação(ões) · status ${dia.status}`
                  }
                </p>
              </div>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-4 space-y-3">
              {modo === 'menu' && (
                <>
                  <p className="text-sm text-gray-600">O que você quer fazer?</p>
                  <button
                    onClick={() => setModo('ajuste')}
                    className="w-full p-3 border rounded-lg hover:bg-blue-50 hover:border-blue-300 flex items-start gap-3 text-left"
                  >
                    <Edit3 className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-gray-900">Solicitar ajuste de marcação</p>
                      <p className="text-xs text-gray-500">Esqueci de bater, marquei errado, caiu a energia, etc.</p>
                    </div>
                  </button>
                  <button
                    onClick={() => setModo('atestado')}
                    className="w-full p-3 border rounded-lg hover:bg-green-50 hover:border-green-300 flex items-start gap-3 text-left"
                  >
                    <FileText className="h-5 w-5 text-green-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-gray-900">Enviar atestado</p>
                      <p className="text-xs text-gray-500">Anexar atestado médico ou comprovante de afastamento</p>
                    </div>
                  </button>
                </>
              )}

              {modo === 'ajuste' && (
                <>
                  {slotInicial && (
                    <div className="rounded-md bg-blue-50 border border-blue-200 px-3 py-2 text-sm text-blue-800">
                      Ajustando: <strong>{TIPO_LABEL[slotInicial.tipo] ?? slotInicial.tipo}</strong> das <strong>{slotInicial.hora}</strong>
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-700">O que aconteceu</label>
                    <select
                      value={tipoAjuste}
                      onChange={(e) => setTipoAjuste(e.target.value)}
                      className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm"
                    >
                      {/* Corrigir horário só faz sentido quando há um slot específico */}
                      {(slotInicial || temMarcacoes) && (
                        <option value="CORRIGIR_HORARIO">Horário marcado está errado</option>
                      )}
                      <option value="ESQUECIMENTO">Esqueci de bater</option>
                      <option value="PROBLEMA_TECNICO">Problema técnico/queda de energia</option>
                      {!slotInicial && <option value="JUSTIFICAR_FALTA">Justificar uma falta</option>}
                    </select>
                  </div>

                  {tipoAjuste !== 'JUSTIFICAR_FALTA' && (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-700">Tipo da marcação</label>
                        <select
                          value={novoTipo}
                          onChange={(e) => setNovoTipo(e.target.value)}
                          className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm"
                        >
                          <option value="ENTRADA">Entrada</option>
                          <option value="SAIDA">Saída</option>
                          <option value="SAIDA_PAUSA_NR17">Saída pausa NR-17</option>
                          <option value="RETORNO_PAUSA_NR17">Retorno pausa NR-17</option>
                          <option value="SAIDA_INTERVALO">Saída intervalo</option>
                          <option value="RETORNO_INTERVALO">Retorno intervalo</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-700">
                          {slotInicial ? 'Horário correto' : 'Horário pretendido'}
                        </label>
                        <Input type="time" value={novoHorario} onChange={(e) => setNovoHorario(e.target.value)} />
                      </div>
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-700">Motivo / explicação</label>
                    <textarea
                      value={justificativa}
                      onChange={(e) => setJustificativa(e.target.value)}
                      rows={3}
                      placeholder="Ex: A internet caiu e não consegui bater a saída."
                      className="flex w-full rounded-md border bg-background px-3 py-2 text-sm"
                    />
                  </div>

                  {erro && <p className="text-sm text-red-600">{erro}</p>}

                  <div className="flex gap-2 pt-2">
                    {!slotInicial && (
                      <Button variant="outline" onClick={() => setModo('menu')} disabled={pending} className="flex-1">Voltar</Button>
                    )}
                    <Button onClick={enviarAjuste} disabled={pending} className="flex-1">
                      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                      Enviar pedido
                    </Button>
                  </div>
                </>
              )}

              {modo === 'atestado' && (
                <>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-700">Arquivo (PDF, JPG ou PNG, até 5MB)</label>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
                      className="block w-full text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border file:border-gray-300 file:text-sm file:bg-white file:hover:bg-gray-50"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-700">De</label>
                      <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-700">Até</label>
                      <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-700">Observação (opcional)</label>
                    <textarea
                      value={justificativa}
                      onChange={(e) => setJustificativa(e.target.value)}
                      rows={2}
                      placeholder="Ex: Consulta médica de rotina"
                      className="flex w-full rounded-md border bg-background px-3 py-2 text-sm"
                    />
                  </div>

                  {erro && <p className="text-sm text-red-600">{erro}</p>}

                  <p className="text-xs text-gray-500">
                    O atestado será analisado automaticamente e encaminhado ao RH para aprovação.
                  </p>

                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" onClick={() => setModo('menu')} disabled={pending} className="flex-1">Voltar</Button>
                    <Button onClick={enviarAtestado} disabled={pending} className="flex-1">
                      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                      Enviar atestado
                    </Button>
                  </div>
                </>
              )}

              {modo === 'sucesso' && (
                <div className="flex flex-col items-center py-6 text-green-600">
                  <CheckCircle2 className="h-12 w-12" />
                  <p className="font-medium mt-2">Enviado com sucesso!</p>
                  <p className="text-xs text-gray-500 mt-1">Você será notificado quando for aprovado.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
