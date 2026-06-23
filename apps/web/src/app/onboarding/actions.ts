'use server'

const API_URL = process.env['API_URL'] ?? 'http://localhost:3000'

export async function verificarToken(token: string) {
  const res = await fetch(`${API_URL}/v1/onboarding/verificar?token=${encodeURIComponent(token)}`, {
    cache: 'no-store',
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    return { ok: false as const, error: (body as { error?: string }).error ?? 'Link inválido' }
  }
  const data = await res.json() as { nome: string; email: string | null }
  return { ok: true as const, nome: data.nome, email: data.email }
}

type CompletarState = { ok: true; email: string | null } | { ok: false; error: string } | undefined

export async function completarOnboardingAction(_prev: CompletarState, formData: FormData): Promise<CompletarState> {
  const token = formData.get('token') as string
  const senha = formData.get('senha') as string
  const confirmar = formData.get('confirmar') as string
  const aceite = formData.get('aceite_lgpd')

  if (!aceite) return { ok: false, error: 'Você precisa aceitar o Aviso de Tratamento de Dados para continuar' }
  if (senha !== confirmar) return { ok: false, error: 'As senhas não conferem' }
  if (senha.length < 6) return { ok: false, error: 'A senha deve ter pelo menos 6 caracteres' }

  const res = await fetch(`${API_URL}/v1/onboarding/completar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, senha, aceite_lgpd: true }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    return { ok: false, error: (body as { error?: string }).error ?? 'Erro ao finalizar cadastro' }
  }

  const data = await res.json() as { email: string | null }
  return { ok: true, email: data.email }
}
