'use client'

import React, { useState, useEffect, useTransition } from 'react'
import { baterPonto, baterHeAction } from './actions'
import { Card, CardContent } from '@/components/ui/card'
import { Clock, CheckCircle2, AlertCircle, Fingerprint, TrendingUp } from 'lucide-react'

const TIPO_LABELS: Record<string, { label: string; cor: string }> = {
  ENTRADA:                  { label: 'Registrar Entrada',          cor: 'bg-green-500 hover:bg-green-600' },
  SAIDA:                    { label: 'Registrar Saída',             cor: 'bg-red-500 hover:bg-red-600' },
  SAIDA_INTERVALO:          { label: 'Saída para Intervalo',        cor: 'bg-orange-500 hover:bg-orange-600' },
  RETORNO_INTERVALO:        { label: 'Retorno do Intervalo',        cor: 'bg-blue-500 hover:bg-blue-600' },
  SAIDA_PAUSA_NR17:         { label: 'Saída Pausa NR-17',           cor: 'bg-yellow-500 hover:bg-yellow-600' },
  RETORNO_PAUSA_NR17:       { label: 'Retorno Pausa NR-17',         cor: 'bg-blue-500 hover:bg-blue-600' },
  SAIDA_PAUSA_FISIOLOGICA:  { label: 'Saída Pausa Fisiológica',     cor: 'bg-purple-500 hover:bg-purple-600' },
  RETORNO_PAUSA_FISIOLOGICA:{ label: 'Retorno Pausa Fisiológica',   cor: 'bg-blue-500 hover:bg-blue-600' },
}

interface ProximoEvento {
  proximoTipo: string
  label: string
  marcacoesHoje: Array<{ tipo: string; timestamp_marcacao: string }>
}

interface Props {
  nomeColaborador: string
  proximoEvento: ProximoEvento | null
  temHeHoje?: boolean
}

type Estado = 'idle' | 'sucesso' | 'erro'

export function PontoClient({ nomeColaborador, proximoEvento, temHeHoje }: Props) {
  const [hora, setHora] = useState('')
  const [data, setData] = useState('')
  const [isPending, startTransition] = useTransition()
  const [estado, setEstado] = useState<Estado>('idle')
  const [mensagem, setMensagem] = useState('')
  const [eventoAtual, setEventoAtual] = useState(proximoEvento)

  useEffect(() => {
    const tick = () => {
      const agora = new Date()
      setHora(agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'America/Sao_Paulo' }))
      setData(agora.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo' }))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  const [alertaSessao, setAlertaSessao] = React.useState<string | undefined>()

  const handleBater = () => {
    startTransition(async () => {
      setEstado('idle')
      setAlertaSessao(undefined)
      const res = await baterPonto()
      if (res.ok) {
        setEstado('sucesso')
        setMensagem(`${res.tipo.replace(/_/g, ' ')} registrada às ${res.hora}`)
        if (res.alerta) setAlertaSessao(res.alerta)
        setTimeout(() => {
          setEstado('idle')
          setMensagem('')
          window.location.reload()
        }, 4000)
      } else {
        setEstado('erro')
        setMensagem(res.error)
        setTimeout(() => { setEstado('idle'); setMensagem('') }, 5000)
      }
    })
  }

  const handleBaterHe = () => {
    startTransition(async () => {
      setEstado('idle')
      const res = await baterHeAction()
      if (res.ok) {
        setEstado('sucesso')
        setMensagem(res.concluida ? 'Hora extra finalizada' : 'Entrada de hora extra registrada')
        setTimeout(() => { setEstado('idle'); setMensagem(''); window.location.reload() }, 3500)
      } else {
        setEstado('erro')
        setMensagem(res.error)
        setTimeout(() => { setEstado('idle'); setMensagem('') }, 5000)
      }
    })
  }

  const tipo = eventoAtual?.proximoTipo ?? 'ENTRADA'
  const btnInfo = TIPO_LABELS[tipo] ?? { label: 'Registrar Ponto', cor: 'bg-blue-500 hover:bg-blue-600' }

  return (
    <div className="w-full max-w-sm space-y-4">
      {/* Relógio */}
      <Card className="text-center">
        <CardContent className="py-8">
          <div className="flex items-center justify-center gap-2 text-gray-500 text-sm mb-2">
            <Clock className="h-4 w-4" />
            <span className="capitalize">{data}</span>
          </div>
          <div className="text-6xl font-mono font-bold text-gray-900 tracking-tight">
            {hora || '--:--:--'}
          </div>
        </CardContent>
      </Card>

      {/* Botão de bater ponto */}
      {estado === 'idle' && (
        <button
          onClick={handleBater}
          disabled={isPending}
          className={`w-full h-20 rounded-xl text-white text-lg font-semibold shadow-lg transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-3 ${btnInfo.cor}`}
        >
          {isPending ? (
            <span className="animate-pulse">Registrando...</span>
          ) : (
            <>
              <Fingerprint className="h-7 w-7" />
              {btnInfo.label}
            </>
          )}
        </button>
      )}

      {/* Botão de bater Hora Extra (quando há HE aprovada para hoje) */}
      {estado === 'idle' && temHeHoje && (
        <button
          onClick={handleBaterHe}
          disabled={isPending}
          className="w-full h-14 rounded-xl text-white font-semibold shadow-md transition-all active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700"
        >
          <TrendingUp className="h-5 w-5" />
          Bater Hora Extra
        </button>
      )}

      {/* Feedback de sucesso */}
      {estado === 'sucesso' && (
        <div className="w-full h-20 rounded-xl bg-green-500 text-white flex items-center justify-center gap-3 text-lg font-semibold shadow-lg">
          <CheckCircle2 className="h-7 w-7" />
          {mensagem}
        </div>
      )}

      {/* Alerta: turno anterior sem saída */}
      {alertaSessao && (
        <div className="w-full rounded-xl bg-yellow-50 border border-yellow-300 text-yellow-800 flex items-start gap-3 px-5 py-4 shadow">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5 text-yellow-600" />
          <p className="text-sm font-medium">{alertaSessao}</p>
        </div>
      )}

      {/* Feedback de erro */}
      {estado === 'erro' && (
        <div className="w-full rounded-xl bg-red-50 border border-red-200 text-red-700 flex items-center gap-3 px-5 py-4 shadow">
          <AlertCircle className="h-6 w-6 shrink-0" />
          <p className="text-sm font-medium">{mensagem}</p>
        </div>
      )}

      {/* Marcações do dia */}
      {eventoAtual && eventoAtual.marcacoesHoje.length > 0 && (
        <Card>
          <CardContent className="py-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Hoje</p>
            <div className="space-y-2">
              {eventoAtual.marcacoesHoje.map((m, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">{m.tipo.replace(/_/g, ' ')}</span>
                  <span className="font-mono font-medium text-gray-900">
                    {new Date(m.timestamp_marcacao).toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                      timeZone: 'America/Sao_Paulo',
                    })}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
