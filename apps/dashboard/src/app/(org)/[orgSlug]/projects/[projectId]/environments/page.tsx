'use client'

import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import {
  CheckCircle2,
  XCircle,
  Clock,
  Globe,
  Lock,
  ChevronRight,
  Layers,
} from 'lucide-react'

type EnvStatus = 'active' | 'failing' | 'idle'

type Environment = {
  id: string
  name: string
  displayName: string
  status: EnvStatus
  domain?: string
  branch: string
  lastDeploy: string
  variableCount: number
  autoDeployEnabled: boolean
}

const STATUS: Record<EnvStatus, { label: string; color: string; dot: string }> = {
  active:  { label: 'Aktiv',   color: 'text-emerald-400', dot: 'bg-emerald-400' },
  failing: { label: 'Fehler',  color: 'text-red-400',     dot: 'bg-red-400' },
  idle:    { label: 'Inaktiv', color: 'text-zinc-500',    dot: 'bg-zinc-600' },
}

function useEnvironments(orgSlug: string, projectId: string) {
  return useQuery<Environment[]>({
    queryKey: ['orgs', orgSlug, 'projects', projectId, 'environments'],
    queryFn: async () => {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? ''
      const res = await fetch(
        `${baseUrl}/organizations/${orgSlug}/projects/${projectId}/environments`,
        { credentials: 'include' }
      )
      if (!res.ok) throw new Error('Umgebungen nicht verfügbar')
      return res.json()
    },
    placeholderData: [
      { id: 'prod',    name: 'production', displayName: 'Production', status: 'active',  domain: 'app.example.com',         branch: 'main',    lastDeploy: 'Vor 5 Min.',  variableCount: 24, autoDeployEnabled: true  },
      { id: 'staging', name: 'staging',    displayName: 'Staging',    status: 'active',  domain: 'staging.example.com',     branch: 'develop', lastDeploy: 'Vor 2 Std.',  variableCount: 18, autoDeployEnabled: true  },
      { id: 'dev',     name: 'dev',        displayName: 'Development', status: 'idle',   domain: 'dev.example.internal',    branch: 'develop', lastDeploy: 'Vor 2 Tagen', variableCount: 12, autoDeployEnabled: false },
    ],
  })
}

export default function EnvironmentsPage() {
  const { orgSlug, projectId } = useParams<{ orgSlug: string; projectId: string }>()
  const router = useRouter()
  const { data: envs = [], isLoading } = useEnvironments(orgSlug, projectId)

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Umgebungen"
        description="Production, Staging und Dev-Umgebungen dieses Projekts"
      />

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl border border-white/[0.06] bg-[#1e272e]" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {envs.map((env) => {
            const s = STATUS[env.status]
            return (
              <button
                key={env.id}
                type="button"
                onClick={() => router.push(`/${orgSlug}/projects/${projectId}/environments/${env.id}`)}
                className="group flex w-full items-center gap-5 rounded-xl border border-white/[0.06] bg-[#1e272e] px-6 py-5 text-left transition-all hover:border-white/[0.12] hover:bg-[#222e38]"
              >
                <div className={`h-2.5 w-2.5 shrink-0 rounded-full ${s.dot}`} />

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-zinc-100">{env.displayName}</span>
                    <span className={`text-xs ${s.color}`}>{s.label}</span>
                    {env.autoDeployEnabled && (
                      <span className="rounded-full border border-white/[0.08] px-2 py-0.5 text-[10px] text-zinc-500">
                        Auto-Deploy
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500">
                    {env.domain && (
                      <span className="flex items-center gap-1">
                        <Globe className="h-3 w-3" />
                        {env.domain}
                      </span>
                    )}
                    <span>Branch: <span className="font-mono">{env.branch}</span></span>
                    <span>Letzter Deploy: {env.lastDeploy}</span>
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                    <Lock className="h-3 w-3" />
                    {env.variableCount} Variablen
                  </div>
                </div>

                <ChevronRight className="h-4 w-4 shrink-0 text-zinc-700 transition-transform group-hover:translate-x-0.5" />
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
