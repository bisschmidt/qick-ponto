import { requireSession } from '@/lib/session'
import { logoutAction } from '@/app/login/actions'
import { Button } from '@/components/ui/button'
import { LogOut } from 'lucide-react'
import { PontoTabs } from './ponto-tabs'

export default async function PontoLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession()

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="flex items-center justify-between p-4 bg-white/80 backdrop-blur border-b">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/qickponto-logo.svg" alt="Qick Ponto" className="h-6 w-auto" />
          <div className="border-l pl-3">
            <p className="font-semibold text-gray-900 leading-tight">{session.nome}</p>
            <p className="text-xs text-gray-500 uppercase tracking-wide">{session.role.replace('_', ' ')}</p>
          </div>
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
