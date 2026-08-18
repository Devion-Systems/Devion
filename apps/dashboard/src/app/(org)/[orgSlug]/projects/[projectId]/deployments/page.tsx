'use client'

import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import {
  CheckCircle2,
  XCircle,
  Clock,
  Activity,
  GitBranch,
  GitCommit,
  User,
  RotateCcw,
  ChevronRight,
} from 'lucide-react'

type DeploymentStatus = 'success' | 'failed' | 'running' | 'pending' | 'cancelled'

type Deployment = {
  id: string
  status: DeploymentStatus
  branch: string
  commit: string
  commitMessage: string
  environment: string
  triggeredBy: string
  startedAt: string
  duration: string
  buildLogs?: string
}

const STATUS: Record<DeploymentStatus, { label: string; color: string; icon: React.ElementType; bg: string }> = {
  success:   { label: 'Erfolgreich',    color: 'text-emerald-400', icon: CheckCircle2, bg: 'bg-emerald-400/10' },
  failed:    { label: 'Fehlgeschlagen', color: 'text-red-400',     icon: XCircle,      bg: 'bg-red-400/10' },
  running:   { label: 'Läuft',          color: 'text-[#0984e3]',   icon: Activity,     bg: 'bg-[#0984e3]/10' },
  pending:   { label: 'Ausstehend',     color: 'text-zinc-400',    icon: Clock,        bg: 'bg-zinc-400/10' },
  cancelled: { label: 'Abgebrochen',    color: 'text-zinc-500',    icon: Clock,        bg: 'bg-zinc-500/10' },
}

function useDeployments(orgSlug: string, projectId: string) {
  return useQuery<Deployment[]>({
    queryKey: ['orgs', orgSlug, 'projects', projectId, 'deployments'],
    queryFn: async () => {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? ''
      const res = await fetch(
        `${baseUrl}/organizations/${orgSlug}/projects/${projectId}/deployments`,
        { credentials: 'include' }
      )
      if (!res.ok) throw new Error('Deployments konnten nicht geladen werden')
      return res.json()
    },
    placeholderData: [
      { id: 'd1', status: 'success',   branch: 'main',         commit: 'a3f8c2d', commitMessage: 'fix: improve error handling',     environment: 'production', triggeredBy: 'Jason J.',   startedAt: 'Vor 5 Min.',   duration: '2m 12s' },
      { id: 'd2', status: 'running',   branch: 'feat/new-ui',  commit: 'b91e4f7', commitMessage: 'feat: redesign dashboard layout',  environment: 'staging',    triggeredBy: 'CI/CD',      startedAt: 'Vor 12 Min.',  duration: '—' },
      { id: 'd3', status: 'failed',    branch: 'main',         commit: 'd5c2a89', commitMessage: 'chore: update dependencies',       environment: 'production', triggeredBy: 'Jason J.',   startedAt: 'Vor 2 Std.',   duration: '45s' },
      { id: 'd4', status: 'success',   branch: 'main',         commit: 'f2e1b4c', commitMessage: 'perf: optimize database queries',  environment: 'production', triggeredBy: 'CI/CD',      startedAt: 'Vor 5 Std.',   duration: '1m 58s' },
      { id: 'd5', status: 'cancelled', branch: 'develop',      commit: 'c7d3e12', commitMessage: 'wip: new auth flow',               environment: 'dev',        triggeredBy: 'Sarah K.',   startedAt: 'Vor 1 Tag',    duration: '12s' },
      { id: 'd6', status: 'success',   branch: 'main',         commit: 'e4a9b01', commitMessage: 'fix: correct timezone handling',   environment: 'production', triggeredBy: 'Jason J.',   startedAt: 'Vor 2 Tagen',  duration: '2m 05s' },
    ],
    refetchInterval: 10_000,
  })
}

export default function DeploymentsPage() {
  const { orgSlug, projectId } = useParams<{ orgSlug: string; projectId: string }>()
  const router = useRouter()
  const { data: deployments = [], isLoading } = useDeployments(orgSlug, projectId)

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Deployments"
        description="Verlauf aller Deployments dieses Projekts"
      />

      <div className="rounded-xl border border-white/[0.06] bg-[#1e272e]">
        {isLoading ? (
          <div className="divide-y divide-white/[0.04]">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 animate-pulse px-5 py-4" />
            ))}
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {deployments.map((dep) => {
              const cfg = STATUS[dep.status]
              const Icon = cfg.icon
              return (
                <button
                  key={dep.id}
                  type="button"
                  onClick={() => router.push(`/${orgSlug}/projects/${projectId}/deployments/${dep.id}`)}
                  className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-white/[0.02]"
                >
                  {/* Status */}
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${cfg.bg}`}>
                    <Icon className={`h-4 w-4 ${cfg.color}`} />
                  </div>

                  {/* Main info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm text-zinc-200">{dep.commit}</span>
                      <span className="shrink-0 rounded border border-white/[0.06] px-1.5 py-0.5 text-[10px] text-zinc-500">
                        {dep.environment}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-zinc-500">{dep.commitMessage}</p>
                  </div>

                  {/* Branch + trigger */}
                  <div className="hidden shrink-0 text-right sm:block">
                    <div className="flex items-center justify-end gap-1.5 text-xs text-zinc-500">
                      <GitBranch className="h-3 w-3" />
                      <span className="font-mono">{dep.branch}</span>
                    </div>
                    <div className="mt-0.5 flex items-center justify-end gap-1.5 text-[11px] text-zinc-600">
                      <User className="h-3 w-3" />
                      {dep.triggeredBy}
                    </div>
                  </div>

                  {/* Time + duration */}
                  <div className="shrink-0 text-right">
                    <p className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</p>
                    <p className="mt-0.5 text-[11px] text-zinc-600">
                      {dep.startedAt} · {dep.duration}
                    </p>
                  </div>

                  <ChevronRight className="h-4 w-4 shrink-0 text-zinc-700" />
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
