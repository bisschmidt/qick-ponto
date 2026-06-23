import { requireSession } from '@/lib/session'
import { logoutAction } from '@/app/login/actions'
import { Button } from '@/components/ui/button'
import { LogOut } from 'lucide-react'
import { PontoTabs } from './ponto-tabs'

export default async function PontoLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession()

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col">
      <header className="flex items-center justify-between p-4 bg-white/80 backdrop-blur border-b">
        <div>
          <p className="font-semibold text-gray-900">{session.nome}</p>
          <p className="text-xs text-gray-500 uppercase tracking-wide">{session.role.replace('_', ' ')}</p>
        </div>
        <form action={logoutAction}>
          <Button variant="ghost" size="icon" type="submit" title="Sair">
            <LogOut className="h-5 w-5 text-gray-500" />
          </Button>
        </form>
      </header>

      <PontoTabs />

      <main className="flex-1 p-4 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
