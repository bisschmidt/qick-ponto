'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Users,
  Clock,
  BarChart3,
  Settings,
  LogOut,
  CheckSquare,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { logoutAction } from '@/app/login/actions'

// `match` lista os prefixos de rota que mantêm o item destacado (grupos com sub-abas).
interface NavItem {
  href: string
  label: string
  icon: typeof LayoutDashboard
  roles: string[]
  match?: string[]
}
const NAV: NavItem[] = [
  { href: '/dashboard',                label: 'Dashboard',       icon: LayoutDashboard, roles: ['ADMIN_TENANT','GESTOR','RH_DP','AUDITOR'] },
  { href: '/dashboard/equipe',         label: 'Minha equipe',    icon: Users,           roles: ['ADMIN_TENANT','GESTOR','RH_DP'] },
  { href: '/dashboard/colaboradores',  label: 'Colaboradores',   icon: Users,           roles: ['ADMIN_TENANT','GESTOR','RH_DP'] },
  { href: '/dashboard/jornadas',       label: 'Jornadas',        icon: Clock,           roles: ['ADMIN_TENANT','RH_DP'] },
  { href: '/dashboard/periodos',       label: 'Folha',           icon: Wallet,          roles: ['ADMIN_TENANT','RH_DP'],
    match: ['/dashboard/periodos','/dashboard/apuracao'] },
  { href: '/dashboard/ajustes',        label: 'Ajustes',         icon: CheckSquare,     roles: ['ADMIN_TENANT','GESTOR','RH_DP'] },
  { href: '/dashboard/he',             label: 'Horas Extras',    icon: TrendingUp,      roles: ['ADMIN_TENANT','GESTOR','RH_DP'],
    match: ['/dashboard/he','/dashboard/banco-horas'] },
  { href: '/dashboard/relatorios',     label: 'Relatórios',      icon: BarChart3,       roles: ['ADMIN_TENANT','GESTOR','RH_DP','AUDITOR'] },
  { href: '/dashboard/admin',          label: 'Administração',   icon: Settings,        roles: ['ADMIN_TENANT','RH_DP','AUDITOR'],
    match: ['/dashboard/admin','/dashboard/feriados','/dashboard/exportacoes'] },
]

// Administração agrega seções com papéis distintos; o item leva à primeira seção
// que o papel pode acessar (ADMIN → Geral, RH → Feriados, Auditor → Exportações).
function adminHrefFor(role: string): string {
  if (role === 'ADMIN_TENANT') return '/dashboard/admin'
  if (role === 'RH_DP') return '/dashboard/feriados'
  return '/dashboard/exportacoes'
}

interface Props { role: string; nome: string }

export function Sidebar({ role, nome }: Props) {
  const pathname = usePathname()
  const navItems = NAV.filter((item) => item.roles.includes(role))

  return (
    <aside className="w-60 bg-white border-r flex flex-col shrink-0">
      <div className="p-5 border-b">
        <h1 className="text-xl font-bold text-blue-600">Qick Ponto</h1>
        <p className="text-xs text-gray-400 mt-0.5">REP-P</p>
      </div>

      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon, match }) => {
          const prefixes = match ?? (href === '/dashboard' ? [] : [href])
          const active = pathname === href || prefixes.some((p) => pathname === p || pathname.startsWith(p + '/'))
          const target = href === '/dashboard/admin' ? adminHrefFor(role) : href
          return (
            <Link
              key={href}
              href={target}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                active ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="p-3 border-t">
        <div className="flex items-center gap-3 px-3 py-2 mb-1">
          <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold text-sm">
            {nome.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{nome}</p>
            <p className="text-xs text-gray-400">{role.replace(/_/g, ' ')}</p>
          </div>
        </div>
        <form action={logoutAction}>
          <button type="submit" className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors">
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </form>
      </div>
    </aside>
  )
}
