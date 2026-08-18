'use client'

import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import {
  Rocket,
  RotateCcw,
  GitBranch,
  GitCommit,
  Clock,
  Globe,
  CheckCircle2,
  XCircle,
  Activity,
  ExternalLink,
  AlertTriangle,
} from 'lucide-react'

type DeploymentStatus = 'success' | 'failed' | 'running' | 'pending'

type ProjectOverview = {
  id: string
  name: string
  description?: string
  domain?: string
  branch: string
  lastCommit: string
  lastCommitMsg: string
  status: DeploymentStatus
  deployedAt: string
  buildDuration: string
  uptime: string
  recentDeployments: Array<{
    id: string
    status: DeploymentStatus
    branch: string
    commit: string
    deployedAt: string
    duration: string
    triggeredBy: string
  }>
}

const STATUS_MAP: Record<DeploymentStatus, { label: string; color: string; icon: React.ElementType }> = {
  success: { label: 'Erfolgreich', color: 'text-emerald-400', icon: CheckCircle2 },
  failed:  { label: 'Fehlgeschlagen', color: 'text-red-400', icon: XCircle },
  running: { label: 'Läuft …', color: 'text-[#0984e3]', icon: Activity },
  pending: { label: 'Ausstehend', color: 'text-zinc-400', icon: Clock },
}

function useProjectOverview(orgSlug: string, projectId: string) {
  return useQuery<ProjectOverview>({
    queryKey: ['orgs', orgSlug, 'projects', projectId, 'overview'],
    queryFn: async () => {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? ''
      const res = await fetch(
        `${baseUrl}/organizations/${orgSlug}/projects/${projectId}`,
        { credentials: 'include' }
      )
      if (!res.ok) throw new Error('Projekt nicht gefunden')
      return res.json()
    },
    placeholderData: {
      id: projectId,
      name: projectId,
      description: 'Kein API-Endpunkt verbunden – Platzhalterdaten',
      domain: 'app.example.com',
      branch: 'main',
      lastCommit: 'a3f8c2d',
      lastCommitMsg: 'fix: improve error handling in auth flow',
      status: 'success',
      deployedAt: 'Vor 5 Min.',
      buildDuration: '2m 12s',
      uptime: '99.98%',
      recentDeployments: [
        { id: 'd1', status: 'success', branch: 'main',        commit: 'a3f8c2d', deployedAt: 'Vor 5 Min.',  duration: '2m 12s', triggeredBy: 'Push' },
        { id: 'd2', status: 'failed',  branch: 'main',        commit: 'b91e4f7', deployedAt: 'Vor 2 Std.', duration: '45s',    triggeredBy: 'Push' },
        { id: 'd3', status: 'success', branch: 'feat/redesign',commit: 'd5c2a89', deployedAt: 'Vor 1 Tag', duration: '1m 58s', triggeredBy: 'PR-Merge' },
      ],
    },
  })
}

export default function ProjectDetailPage() {
  const { orgSlug, projectId } = useParams<{ orgSlug: string; projectId: string }>()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { data: project, isLoading } = useProjectOverview(orgSlug, projectId)

  const deployMutation = useMutation({
    mutationFn: async () => {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? ''
      const res = await fetch(
        `${baseUrl}/organizations/${orgSlug}/projects/${projectId}/deploy`,
        { method: 'POST', credentials: 'include' }
      )
      if (!res.ok) throw new Error('Deployment fehlgeschlagen')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orgs', orgSlug, 'projects', projectId] })
    },
  })

  if (isLoading || !project) {
    return (
      <div className="space-y-4 p-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl border border-white/[0.06] bg-[#1e272e]" />
        ))}
      </div>
    )
  }

  const statusCfg = STATUS_MAP[project.status]
  const StatusIcon = statusCfg.icon

  return (
    <div className="space-y-6 p-6">
      {/* Quick-Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <StatusIcon className={`h-4 w-4 ${statusCfg.color}`} />
          <span className={`text-sm font-medium ${statusCfg.color}`}>{statusCfg.label}</span>
          <span className="text-zinc-700">·</span>
          <span className="text-sm text-zinc-500">{project.deployedAt}</span>
        </div>
        <div className="flex gap-2">
          {project.domain && (
            <Button variant="outline" size="sm" asChild>
              <a href={`https://${project.domain}`} target="_blank" rel="noopener noreferrer" className="gap-1.5">
                <ExternalLink className="h-3.5 w-3.5" />
                {project.domain}
              </a>
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => router.push(`/${orgSlug}/projects/${projectId}/deployments`)}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Rollback
          </Button>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => deployMutation.mutate()}
            disabled={deployMutation.isPending}
          >
            <Rocket className="h-3.5 w-3.5" />
            {deployMutation.isPending ? 'Deploying …' : 'Deploy'}
          </Button>
        </div>
      </div>

      {/* Info-Karten */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { icon: GitBranch, label: 'Branch', value: project.branch },
          { icon: GitCommit, label: 'Letzter Commit', value: `${project.lastCommit} – ${project.lastCommitMsg}` },
          { icon: Clock,     label: 'Uptime',         value: project.uptime },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="rounded-xl border border-white/[0.06] bg-[#1e272e] p-4">
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <Icon className="h-3.5 w-3.5" />
              {label}
            </div>
            <p className="mt-1.5 truncate text-sm font-medium text-zinc-200">{value}</p>
          </div>
        ))}
      </div>

      {/* Letzte Deployments */}
      <div className="rounded-xl border border-white/[0.06] bg-[#1e272e]">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <h2 className="text-sm font-semibold text-zinc-100">Letzte Deployments</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/${orgSlug}/projects/${projectId}/deployments`)}
          >
            Alle ansehen
          </Button>
        </div>
        <div className="divide-y divide-white/[0.04]">
          {project.recentDeployments.map((dep) => {
            const cfg = STATUS_MAP[dep.status]
            const Icon = cfg.icon
            return (
              <button
                key={dep.id}
                type="button"
                onClick={() => router.push(`/${orgSlug}/projects/${projectId}/deployments/${dep.id}`)}
                className="flex w-full items-center gap-4 px-5 py-3.5 text-left transition-colors hover:bg-white/[0.02]"
              >
                <Icon className={`h-4 w-4 shrink-0 ${cfg.color}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-zinc-200">{dep.commit}</span>
                    <span className="rounded border border-white/[0.06] px-1.5 py-0.5 text-[10px] text-zinc-500">
                      {dep.branch}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-zinc-600">
                    {dep.triggeredBy} · Dauer: {dep.duration}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <span className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
                  <p className="mt-0.5 text-[11px] text-zinc-600">{dep.deployedAt}</p>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
