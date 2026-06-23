'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Fingerprint, ClipboardList, MessageSquare, FileText, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'

const TABS = [
  { href: '/ponto',              label: 'Bater ponto',  icon: Fingerprint },
  { href: '/ponto/ficha',        label: 'Ficha ponto',  icon: ClipboardList },
  { href: '/ponto/compensacao',  label: 'Horas Extras', icon: TrendingUp },
  { href: '/ponto/solicitacoes', label: 'Solicitações', icon: MessageSquare },
  { href: '/ponto/espelhos',     label: 'Espelhos',     icon: FileText },
]

export function PontoTabs() {
  const pathname = usePathname()
  return (
    <nav className="bg-white/60 border-b overflow-x-auto">
      <div className="flex max-w-3xl mx-auto px-2">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = href === '/ponto' ? pathname === href : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                active
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700',
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
