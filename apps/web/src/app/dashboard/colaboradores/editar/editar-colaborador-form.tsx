'use client'

import React, { useActionState, useTransition, useState } from 'react'
import { editarColaboradorAction, definirSenhaAction, aceitarLgpdAction, reenviarConviteAction, salvarCodigoFolhaAction, desligarAction, reativarAction } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, Save, Key, ShieldCheck, Mail, FileSpreadsheet, CheckCircle2, UserX, RotateCcw } from 'lucide-react'

interface Props {
  colaborador: {
    id: string
    nome_completo: string
    email_corporativo: string
    whatsapp: string
    centro_custo: string
    operacao_cliente: string
    onboarding_ok: boolean
    ativo: boolean
    data_desligamento: string | null
  }
  jornadaAtual: { id: string; nome: string } | null
  jornadas: { id: string; nome: string }[]
  codigoQuestor: string
  userRole: string
}

export function EditarColaboradorForm({ colaborador, jornadaAtual, jornadas, codigoQuestor, userRole }: Props) {
  const podeDesligar = userRole === 'ADMIN_TENANT' || userRole === 'RH_DP'
  const hojeStr = new Date().toISOString().slice(0, 10)
  const [dataDeslig, setDataDeslig] = useState(hojeStr)
  const [desligPending, startDeslig] = useTransition()
  const [desligErro, setDesligErro] = useState<string | null>(null)

  function executarDesligamento() {
    if (!confirm(`Desligar ${colaborador.nome_completo} em ${dataDeslig}? Login e marcações ficarão bloqueados.`)) return
    setDesligErro(null)
    startDeslig(async () => {
      const r = await desligarAction(colaborador.id, dataDeslig)
      if (r.ok) window.location.reload()
      else setDesligErro(r.error)
    })
  }
  function executarReativacao() {
    if (!confirm(`Reativar ${colaborador.nome_completo}? Login será liberado novamente.`)) return
    setDesligErro(null)
    startDeslig(async () => {
      const r = await reativarAction(colaborador.id)
      if (r.ok) window.location.reload()
      else setDesligErro(r.error)
    })
  }

  const [state, action, isPending] = useActionState(editarColaboradorAction, undefined)
  const [senhaState, senhaAction, senhaPending] = useActionState(definirSenhaAction, undefined)
  const [lgpdPending, startLgpd] = useTransition()
  const [lgpdOk, setLgpdOk] = useState(colaborador.onboarding_ok)
  const [lgpdError, setLgpdError] = useState<string | undefined>()
  const [convitePending, startConvite] = useTransition()
  const [conviteOk, setConviteOk] = useState(false)
  const [conviteError, setConviteError] = useState<string | undefined>()
  const [codigoFolha, setCodigoFolha] = useState(codigoQuestor)
  const [codigoFolhaPending, startCodigoFolha] = useTransition()
  const [codigoFolhaOk, setCodigoFolhaOk] = useState(false)
  const [codigoFolhaError, setCodigoFolhaError] = useState<string | null>(null)

  function handleSalvarCodigoFolha() {
    setCodigoFolhaError(null)
    setCodigoFolhaOk(false)
    if (!codigoFolha.trim()) {
      setCodigoFolhaError('Informe o código')
      return
    }
    startCodigoFolha(async () => {
      const r = await salvarCodigoFolhaAction({
        colaborador_id: colaborador.id,
        sistema: 'QUESTOR',
        codigo: codigoFolha.trim(),
      })
      if (r.ok) setCodigoFolhaOk(true)
      else setCodigoFolhaError(r.error)
    })
  }

  function handleReenviarConvite() {
    startConvite(async () => {
      const result = await reenviarConviteAction(colaborador.id)
      if (result?.ok) setConviteOk(true)
      else setConviteError(result?.error)
    })
  }

  async function handleAceitarLgpd() {
    startLgpd(async () => {
      const result = await aceitarLgpdAction(colaborador.id)
      if (result?.ok) setLgpdOk(true)
      else setLgpdError(result?.error)
    })
  }

  return (
    <div className="space-y-6">
    <form action={action} className="space-y-6">
      <input type="hidden" name="id" value={colaborador.id} />

      <Card>
        <CardContent className="pt-6 space-y-4">
          <h2 className="font-semibold text-gray-700">Dados pessoais</h2>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Nome completo</label>
            <Input name="nome_completo" defaultValue={colaborador.nome_completo} required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">E-mail corporativo</label>
              <Input name="email_corporativo" type="email" defaultValue={colaborador.email_corporativo} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">WhatsApp</label>
              <Input name="whatsapp" defaultValue={colaborador.whatsapp} placeholder="11999999999" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Centro de custo</label>
              <Input name="centro_custo" defaultValue={colaborador.centro_custo} required />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Operação / cliente</label>
              <Input name="operacao_cliente" defaultValue={colaborador.operacao_cliente} required />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 space-y-3">
          <div>
            <h2 className="font-semibold text-gray-700">Jornada de trabalho</h2>
            {jornadaAtual && (
              <p className="text-sm text-gray-500 mt-1">
                Atual: <strong>{jornadaAtual.nome}</strong>
              </p>
            )}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              {jornadaAtual ? 'Trocar para' : 'Vincular jornada'}
            </label>
            <select
              name="nova_jornada_id"
              defaultValue=""
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Manter atual</option>
              {jornadas.filter((j) => j.id !== jornadaAtual?.id).map((j) => (
                <option key={j.id} value={j.id}>{j.nome}</option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar alterações
        </Button>
        {state && !state.ok && (
          <p className="text-sm text-red-600">{state.error}</p>
        )}
        {state?.ok && (
          <p className="text-sm text-green-600">Salvo com sucesso</p>
        )}
      </div>
    </form>

    {/* Reenviar convite por email */}
    {colaborador.email_corporativo && (
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-gray-500" />
            <h2 className="font-semibold text-gray-700">Convite de acesso</h2>
          </div>
          <p className="text-sm text-gray-500">
            Envia um email para <strong>{colaborador.email_corporativo}</strong> com o link para o colaborador definir a própria senha e aceitar o LGPD.
          </p>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={handleReenviarConvite} disabled={convitePending}>
              {convitePending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              {colaborador.onboarding_ok ? 'Reenviar convite' : 'Enviar convite'}
            </Button>
            {conviteOk && <p className="text-sm text-green-600">Convite enviado para {colaborador.email_corporativo}</p>}
            {conviteError && <p className="text-sm text-red-600">{conviteError}</p>}
          </div>
        </CardContent>
      </Card>
    )}

    {/* Definir senha */}
    <form action={senhaAction} className="space-y-0">
      <input type="hidden" name="id" value={colaborador.id} />
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center gap-2">
            <Key className="h-4 w-4 text-gray-500" />
            <h2 className="font-semibold text-gray-700">Senha de acesso</h2>
          </div>
          <p className="text-sm text-gray-500">
            Define ou redefine a senha que o colaborador usa para entrar no sistema.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Nova senha</label>
              <Input name="senha" type="password" placeholder="mínimo 6 caracteres" required />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Confirmar senha</label>
              <Input name="confirmar" type="password" placeholder="repita a senha" required />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit" variant="outline" disabled={senhaPending}>
              {senhaPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Key className="h-4 w-4" />}
              Definir senha
            </Button>
            {senhaState?.ok && <p className="text-sm text-green-600">Senha definida com sucesso</p>}
            {senhaState && !senhaState.ok && <p className="text-sm text-red-600">{senhaState.error}</p>}
          </div>
        </CardContent>
      </Card>
    </form>

    {/* Aceite LGPD */}
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-gray-500" />
            <h2 className="font-semibold text-gray-700">Aviso de Tratamento de Dados (LGPD)</h2>
          </div>
          <Badge variant={lgpdOk ? 'success' : 'outline'}>
            {lgpdOk ? 'Aceito' : 'Pendente'}
          </Badge>
        </div>
        {!lgpdOk && (
          <>
            <p className="text-sm text-gray-500">
              O colaborador precisa aceitar o aviso antes de registrar o ponto. Use este botão se o aceite foi feito presencialmente ou por outro canal.
            </p>
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={handleAceitarLgpd} disabled={lgpdPending}>
                {lgpdPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                Registrar aceite presencial
              </Button>
              {lgpdError && <p className="text-sm text-red-600">{lgpdError}</p>}
            </div>
          </>
        )}
        {lgpdOk && (
          <p className="text-sm text-green-700">Aceite registrado — colaborador pode bater ponto.</p>
        )}
      </CardContent>
    </Card>

    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4 text-gray-500" />
          <h2 className="font-semibold text-gray-700">Código no sistema de folha</h2>
        </div>
        <div className="grid grid-cols-[120px_1fr_auto] gap-3 items-end">
          <div className="space-y-1">
            <label className="text-xs text-gray-500">Sistema</label>
            <Input value="QUESTOR" disabled />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-gray-500">Código do funcionário</label>
            <Input
              value={codigoFolha}
              onChange={(e) => { setCodigoFolha(e.target.value); setCodigoFolhaOk(false) }}
              placeholder="ex.: 9001"
              maxLength={20}
            />
          </div>
          <Button onClick={handleSalvarCodigoFolha} disabled={codigoFolhaPending}>
            {codigoFolhaPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar
          </Button>
        </div>
        {codigoFolhaOk && (
          <p className="text-sm text-green-600 flex items-center gap-1">
            <CheckCircle2 className="h-4 w-4" />
            Código salvo
          </p>
        )}
        {codigoFolhaError && <p className="text-sm text-red-600">{codigoFolhaError}</p>}
        <p className="text-xs text-gray-500">
          Necessário para exportar os eventos de folha (HE, faltas, etc) para o QUESTOR.
        </p>
      </CardContent>
    </Card>

    {podeDesligar && (
      <Card className={colaborador.ativo ? 'border-red-200' : 'border-amber-200 bg-amber-50/40'}>
        <CardContent className="pt-6 space-y-3">
          <div className="flex items-center gap-2">
            <UserX className="h-4 w-4 text-gray-500" />
            <h2 className="font-semibold text-gray-700">
              {colaborador.ativo ? 'Desligamento' : 'Colaborador desligado'}
            </h2>
            {!colaborador.ativo && (
              <Badge variant="destructive">
                Inativo
                {colaborador.data_desligamento && ` desde ${colaborador.data_desligamento.slice(0, 10).split('-').reverse().join('/')}`}
              </Badge>
            )}
          </div>
          {colaborador.ativo ? (
            <>
              <p className="text-sm text-gray-600">
                Encerra o vínculo. Login do colaborador é bloqueado, jornada vigente é encerrada
                e ele não consegue mais bater ponto. Use a data efetiva do desligamento.
              </p>
              <div className="flex items-end gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-700">Data do desligamento</label>
                  <Input type="date" value={dataDeslig} onChange={(e) => setDataDeslig(e.target.value)} />
                </div>
                <Button variant="destructive" onClick={executarDesligamento} disabled={desligPending}>
                  {desligPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserX className="h-4 w-4" />}
                  Desligar colaborador
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-600">
                Esse colaborador está inativo. Caso ele tenha sido desligado por engano, é possível reativá-lo.
              </p>
              <Button variant="outline" onClick={executarReativacao} disabled={desligPending}>
                {desligPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                Reativar colaborador
              </Button>
            </>
          )}
          {desligErro && <p className="text-sm text-red-600">{desligErro}</p>}
        </CardContent>
      </Card>
    )}
    </div>
  )
}
