import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { LoginForm } from './login-form'

export default async function LoginPage() {
  const session = await getSession()
  if (session) redirect('/')

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center text-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/qickponto-logo.svg" alt="Qick Ponto" className="h-10 w-auto" />
          <p className="text-gray-500 mt-3">Sistema de ponto eletrônico REP-P</p>
        </div>
        <LoginForm />
      </div>
    </div>
  )
}
