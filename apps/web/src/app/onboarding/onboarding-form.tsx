'use client'

import { useActionState } from 'react'
import { completarOnboardingAction } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2, ShieldCheck } from 'lucide-react'
import Link from 'next/link'

interface Props {
  token: string
  nome: string
}

export function OnboardingForm({ token, nome }: Props) {
  const [state, action, isPending] = useActionState(completarOnboardingAction, undefined)

  if (state?.ok) {
    return (
      <div className="text-center space-y-4">
        <ShieldCheck className="h-12 w-12 text-green-500 mx-auto" />
        <h2 className="text-xl font-bold text-gray-900">Tudo certo!</h2>
        <p className="text-gray-600">Sua senha foi definida e o aceite foi registrado.</p>
        <Button asChild>
          <Link href="/login">Entrar no sistema</Link>
        </Button>
      </div>
    )
  }

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="token" value={token} />

      <p className="text-gray-700">
        Olá, <strong>{nome}</strong>! Para acessar o sistema, defina sua senha e aceite o Aviso de Tratamento de Dados.
      </p>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <h2 className="font-semibold text-gray-700">Defina sua senha</h2>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Nova senha</label>
            <Input name="senha" type="password" placeholder="mínimo 6 caracteres" required />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Confirmar senha</label>
            <Input name="confirmar" type="password" placeholder="repita a senha" required />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <h2 className="font-semibold text-gray-700">Aviso de Tratamento de Dados — LGPD</h2>
          <div className="text-sm text-gray-600 space-y-2 max-h-48 overflow-y-auto border rounded p-3 bg-gray-50">
            <p><strong>Qick Ponto — Aviso de Privacidade (versão 1.0)</strong></p>
            <p>
              A <strong>Qick.ai</strong> coleta e trata os seguintes dados pessoais para controle de jornada de trabalho
              conforme exigência da <strong>Portaria MTP 671/2021</strong> e da <strong>CLT</strong>:
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li>Nome completo, CPF e PIS/NIT</li>
              <li>Horários e localizações de marcação de ponto</li>
              <li>Dados de jornada, horas extras e banco de horas</li>
            </ul>
            <p>
              Os dados são utilizados exclusivamente para fins trabalhistas e fiscais, compartilhados com o empregador
              e, quando exigido, com autoridades competentes. Armazenados por no mínimo 5 anos conforme legislação.
            </p>
            <p>
              Você tem direito de acessar, corrigir ou solicitar a portabilidade dos seus dados.
              Contato: privacidade@qick.ai
            </p>
          </div>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              name="aceite_lgpd"
              value="true"
              required
              className="mt-0.5 h-4 w-4 rounded border-gray-300"
            />
            <span className="text-sm text-gray-700">
              Li e aceito o Aviso de Tratamento de Dados acima.
            </span>
          </label>
        </CardContent>
      </Card>

      {state && !state.ok && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        Definir senha e aceitar
      </Button>
    </form>
  )
}
