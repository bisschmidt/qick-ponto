import { requireSession } from '@/lib/session'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/dashboard/sidebar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession()

  if (session.role === 'COLABORADOR') redirect('/ponto')

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar role={session.role} nome={session.nome} />
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  )
}
