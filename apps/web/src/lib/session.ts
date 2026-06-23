import { cookies } from 'next/headers'
import { jwtVerify } from 'jose'

export interface Session {
  sub: string
  tenantId: string
  role: string
  cnpj: string
  nome: string
  token: string
}

const JWT_SECRET = new TextEncoder().encode(
  process.env['JWT_SECRET'] ?? 'qick-ponto-dev-secret-2025',
)

export async function getSession(): Promise<Session | null> {
  const store = await cookies()
  const token = store.get('qp_token')?.value
  if (!token) return null

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return {
      sub: payload['sub'] as string,
      tenantId: payload['tenantId'] as string,
      role: payload['role'] as string,
      cnpj: payload['cnpj'] as string,
      nome: (payload['nome'] as string) ?? '',
      token,
    }
  } catch {
    return null
  }
}

export async function requireSession(): Promise<Session> {
  const session = await getSession()
  if (!session) throw new Error('Não autenticado')
  return session
}
