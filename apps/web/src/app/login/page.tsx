import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { LoginForm } from './login-form'

export default async function LoginPage() {
  const session = await getSession()
  if (session) redirect('/')

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Qick Ponto</h1>
          <p className="text-gray-500 mt-1">Sistema de ponto eletrônico REP-P</p>
        </div>
        <LoginForm />
      </div>
    </div>
  )
}
