'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { api, ApiError } from '@/lib/api'

interface LoginResponse {
  token: string
  colaborador: { id: string; nome_completo: string; role: string }
}

export async function loginAction(
  _prev: { error: string } | undefined,
  formData: FormData,
) {
  const email = formData.get('email') as string
  const senha = formData.get('senha') as string

  try {
    const res = await api.post<LoginResponse>('/v1/auth/login', { email, senha })

    const store = await cookies()
    store.set('qp_token', res.token, {
      httpOnly: true,
      secure: process.env['NODE_ENV'] === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 8, // 8 horas
      path: '/',
    })
  } catch (err) {
    if (err instanceof ApiError) {
      return { error: err.status === 401 ? 'Email ou senha incorretos' : err.message }
    }
    return { error: 'Erro ao conectar com o servidor' }
  }

  redirect('/')
}

export async function logoutAction() {
  const store = await cookies()
  store.delete('qp_token')
  redirect('/login')
}
