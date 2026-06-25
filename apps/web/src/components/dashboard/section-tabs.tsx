'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

export interface SectionTab {
  label: string
  href: string
  /** prefixo usado para destacar a aba ativa; default = href */
  match?: string
  /** se definido, só aparece para estes papéis */
  roles?: string[]
}

// Grupos de navegação de segundo nível (espelham a estrutura da sidebar)
export const FOLHA_TABS: SectionTab[] = [
  { label: 'Períodos',  href: '/dashboard/periodos' },
  { label: 'Apuração',  href: '/dashboard/apuracao' },
]

export const HE_TABS: SectionTab[] = [
  { label: 'Gestão de HE',   href: '/dashboard/he', match: '/dashboard/he' },
  { label: 'Banco de Horas', href: '/dashboard/banco-horas' },
]

// Acesso preservado do menu antigo: Feriados (ADMIN/RH), Exportações (ADMIN/RH/Auditor),
// Geral/config do tenant (ADMIN apenas).
export const ADMIN_TABS: SectionTab[] = [
  { label: 'Geral',        href: '/dashboard/admin',        roles: ['ADMIN_TENANT'] },
  { label: 'Feriados',     href: '/dashboard/feriados',     roles: ['ADMIN_TENANT','RH_DP'] },
  { label: 'Exportações',  href: '/dashboard/exportacoes',  roles: ['ADMIN_TENANT','RH_DP','AUDITOR'] },
]

export function adminTabsFor(role: string): SectionTab[] {
  return ADMIN_TABS.filter((t) => !t.roles || t.roles.includes(role))
}

export function SectionTabs({ tabs }: { tabs: SectionTab[] }) {
  const pathname = usePathname()
  return (
    <div className="border-b border-gray-200 flex gap-1 overflow-x-auto">
      {tabs.map((t) => {
        const prefix = t.match ?? t.href
        const active = pathname === t.href || pathname.startsWith(prefix + '/') || pathname === prefix
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors',
              active
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
            )}
          >
            {t.label}
          </Link>
        )
      })}
    </div>
  )
}
