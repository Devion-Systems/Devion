'use client'

import Link from 'next/link'
import { useParams, usePathname } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import {
  LayoutDashboard,
  Rocket,
  Layers,
  ScrollText,
  BarChart2,
  Globe,
  Settings,
  CheckCircle2,
  XCircle,
  Activity,
  Clock,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type Project = {
  id: string
  name: string
  status: 'healthy' | 'failing' | 'degraded' | 'idle'
}

const STATUS_DOT: Record<Project['status'], string> = {
  healthy:  'bg-emerald-400',
  failing:  'bg-red-400',
  degraded: 'bg-amber-400',
  idle:     'bg-zinc-600',
}

function useProject(orgSlug: string, projectId: string) {
  return useQuery<Project>({
    queryKey: ['orgs', orgSlug, 'projects', projectId],
    queryFn: async () => {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? ''
      const res = await fetch(`${baseUrl}/organizations/${orgSlug}/projects/${projectId}`, {
        credentials: 'include',
      })
      if (!res.ok) throw new Error('Projekt nicht gefunden')
      return res.json()
    },
  })
}

const TABS = [
  { label: 'Übersicht',    icon: LayoutDashboard, segment: ''              },
  { label: 'Deployments',  icon: Rocket,          segment: 'deployments'  },
  { label: 'Umgebungen',   icon: Layers,          segment: 'environments' },
  { label: 'Logs',         icon: ScrollText,      segment: 'logs'         },
  { label: 'Metriken',     icon: BarChart2,       segment: 'metrics'      },
  { label: 'Domains',      icon: Globe,           segment: 'domains'      },
  { label: 'Einstellungen',icon: Settings,        segment: 'settings/general' },
]

export default function ProjectsDetailLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { orgSlug, projectId } = useParams<{ orgSlug: string; projectId: string }>()
  const pathname = usePathname()
  const { data: project } = useProject(orgSlug, projectId)

  const base = `/${orgSlug}/projects/${projectId}`

  function isActive(segment: string) {
    if (segment === '') return pathname === base
    return pathname.startsWith(`${base}/${segment.split('/')[0]}`)
  }

  return (
    <div className="flex flex-col">
      {/* Project Header */}
      <div className="border-b border-white/[0.06] bg-[#11191f] px-6 pt-5">
        <div className="mb-4 flex items-center gap-3">
          {project && (
            <span className={`h-2 w-2 rounded-full ${STATUS_DOT[project.status] ?? 'bg-zinc-600'}`} />
          )}
          <h1 className="text-lg font-semibold text-zinc-100">
            {project?.name ?? projectId}
          </h1>
        </div>

        {/* Tabs */}
        <nav className="flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map(({ label, icon: Icon, segment }) => {
            const active = isActive(segment)
            const href = segment ? `${base}/${segment}` : base
            return (
              <Link
                key={segment}
                href={href}
                className={cn(
                  'flex shrink-0 items-center gap-1.5 rounded-t-md border-b-2 px-3 pb-2.5 pt-2 text-sm transition-colors',
                  active
                    ? 'border-[#0984e3] text-zinc-100'
                    : 'border-transparent text-zinc-500 hover:text-zinc-300',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </Link>
            )
          })}
        </nav>
      </div>

      {/* Page Content */}
      <div className="flex-1">{children}</div>
    </div>
  )
}
