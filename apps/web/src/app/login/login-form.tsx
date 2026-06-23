'use client'

import { useActionState } from 'react'
import { loginAction } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'

export function LoginForm() {
  const [state, action, isPending] = useActionState(loginAction, undefined)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Entrar</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium text-gray-700">
              Email
            </label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="seu@email.com"
              required
              autoComplete="email"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="senha" className="text-sm font-medium text-gray-700">
              Senha
            </label>
            <Input
              id="senha"
              name="senha"
              type="password"
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>

          {state?.error && (
            <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {state.error}
            </div>
          )}

          <Button type="submit" className="w-full" size="lg" disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Entrando...
              </>
            ) : (
              'Entrar'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
