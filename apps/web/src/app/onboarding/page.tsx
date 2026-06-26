import { verificarToken } from './actions'
import { OnboardingForm } from './onboarding-form'
import { AlertTriangle } from 'lucide-react'

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center space-y-3">
          <AlertTriangle className="h-10 w-10 text-yellow-500 mx-auto" />
          <h1 className="text-lg font-bold text-gray-900">Link inválido</h1>
          <p className="text-gray-500 text-sm">Acesse o link enviado por email para continuar.</p>
        </div>
      </div>
    )
  }

  const result = await verificarToken(token)

  if (!result.ok) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center space-y-3">
          <AlertTriangle className="h-10 w-10 text-red-500 mx-auto" />
          <h1 className="text-lg font-bold text-gray-900">Link inválido ou expirado</h1>
          <p className="text-gray-500 text-sm">{result.error}</p>
          <p className="text-gray-400 text-xs">Solicite ao seu gestor que reenvie o convite.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-start justify-center p-4 pt-12">
      <div className="w-full max-w-lg space-y-6">
        <div className="flex flex-col items-center text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/qickponto-logo.svg" alt="Qick Ponto" className="h-9 w-auto" />
          <p className="text-gray-500 text-sm mt-3">Bem-vindo(a)! Configure seu acesso abaixo.</p>
        </div>
        <OnboardingForm token={token} nome={result.nome} />
      </div>
    </div>
  )
}
