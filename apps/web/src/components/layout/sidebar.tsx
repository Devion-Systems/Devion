// components/layout/sidebar.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Server,
  Users,
  CreditCard,
  Settings,
  ChevronLeft,
  LogOut,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type NavItem = {
  label: string
  href: string
  icon: React.ElementType
}

const adminNav: NavItem[] = [
  { label: 'Übersicht', href: '/admin', icon: LayoutDashboard },
]

const userNav: NavItem[] = [
  { label: 'Übersicht', href: '/user/dashboard', icon: LayoutDashboard },
  { label: 'Meine Server', href: '/user/servers', icon: Server },
  { label: 'Abrechnung', href: '/user/billing', icon: CreditCard },
]

export function Sidebar({ role = 'user' }: { role?: 'admin' | 'user' }) {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()
  const items = role === 'admin' ? adminNav : userNav

  return (
    <aside
      className={cn(
        'flex h-screen flex-col border-r border-zinc-800 bg-zinc-950 transition-all duration-200',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Logo / Header */}
      <div className="flex h-14 items-center justify-between border-b border-zinc-800 px-4">
        {!collapsed && (
          <span className="text-sm font-semibold tracking-tight text-zinc-100">
            snyxe
          </span>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-900 hover:text-zinc-200"
        >
          <ChevronLeft
            className={cn('h-4 w-4 transition-transform', collapsed && 'rotate-180')}
          />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-4">
        {items.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + '/')
          const Icon = item.icon

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-zinc-900 text-zinc-100'
                  : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
              {isActive && !collapsed && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-500" />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-zinc-800 p-2">
        <Link
          href="/settings"
          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
        >
          <Settings className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Einstellungen</span>}
        </Link>
        <button
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
          onClick={() => {/* signOut() */}}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Abmelden</span>}
        </button>
      </div>
    </aside>
  )
}