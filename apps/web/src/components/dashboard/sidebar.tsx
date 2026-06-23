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
  Calendar,
  FileText,
  LogOut,
  ClipboardList,
  Banknote,
  CheckSquare,
  TrendingUp,
} from 'lucide-react'
import { logoutAction } from '@/app/login/actions'

const NAV = [
  { href: '/dashboard',                label: 'Dashboard',       icon: LayoutDashboard, roles: ['ADMIN_TENANT','GESTOR','RH_DP','AUDITOR'] },
  { href: '/dashboard/equipe',         label: 'Minha equipe',    icon: Users,           roles: ['ADMIN_TENANT','GESTOR','RH_DP'] },
  { href: '/dashboard/colaboradores',  label: 'Colaboradores',   icon: Users,           roles: ['ADMIN_TENANT','GESTOR','RH_DP'] },
  { href: '/dashboard/jornadas',       label: 'Jornadas',        icon: Clock,           roles: ['ADMIN_TENANT','RH_DP'] },
  { href: '/dashboard/feriados',       label: 'Feriados',        icon: Calendar,        roles: ['ADMIN_TENANT','RH_DP'] },
  { href: '/dashboard/apuracao',       label: 'Apuração',        icon: ClipboardList,   roles: ['ADMIN_TENANT','GESTOR','RH_DP'] },
  { href: '/dashboard/periodos',       label: 'Períodos',        icon: Calendar,        roles: ['ADMIN_TENANT','RH_DP'] },
  { href: '/dashboard/ajustes',        label: 'Ajustes',         icon: CheckSquare,     roles: ['ADMIN_TENANT','GESTOR','RH_DP'] },
  { href: '/dashboard/he',             label: 'Horas Extras',    icon: TrendingUp,      roles: ['ADMIN_TENANT','GESTOR','RH_DP'] },
  { href: '/dashboard/banco-horas',    label: 'Banco de Horas',  icon: Banknote,        roles: ['ADMIN_TENANT','GESTOR','RH_DP'] },
  { href: '/dashboard/relatorios',     label: 'Relatórios',      icon: BarChart3,       roles: ['ADMIN_TENANT','GESTOR','RH_DP','AUDITOR'] },
  { href: '/dashboard/exportacoes',    label: 'Exportações',     icon: FileText,        roles: ['ADMIN_TENANT','RH_DP','AUDITOR'] },
  { href: '/dashboard/admin',           label: 'Administração',   icon: Settings,        roles: ['ADMIN_TENANT'] },
]

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
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
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
