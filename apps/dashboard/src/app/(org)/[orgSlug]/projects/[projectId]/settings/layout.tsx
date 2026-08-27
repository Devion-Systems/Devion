'use client'

import Link from 'next/link'
import { useParams, usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const TABS = [
  { label: 'Allgemein',     href: 'general' },
  { label: 'Zugriff',       href: 'access' },
  { label: 'Environments',  href: '../environments' },
  { label: 'Danger Zone',   href: 'danger-zone' },
]

export default function ProjectSettingsLayout({ children }: { children: React.ReactNode }) {
  const { orgSlug, projectId } = useParams<{ orgSlug: string; projectId: string }>()
  const pathname = usePathname()
  const base = `/${orgSlug}/projects/${projectId}/settings`

  return (
    <div className="flex gap-8 p-6">
      {/* Side nav */}
      <nav className="w-44 shrink-0 space-y-1">
        {TABS.map(({ label, href }) => {
          const target = href.startsWith('..') ? `/${orgSlug}/projects/${projectId}/environments` : `${base}/${href}`
          const active = pathname === target || pathname.startsWith(`${target}/`)
          return (
            <Link
              key={href}
              href={target}
              className={cn(
                'block rounded-lg px-3 py-2 text-sm transition-colors',
                active
                  ? 'bg-white/[0.06] text-zinc-100'
                  : 'text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300'
              )}
            >
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Content */}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
