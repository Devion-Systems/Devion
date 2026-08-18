'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
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
  ChevronLeft,
  Terminal,
  AlertTriangle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type DeploymentStatus = 'success' | 'failed' | 'running' | 'pending'

type DeploymentDetail = {
  id: string
  status: DeploymentStatus
  branch: string
  commit: string
  commitMessage: string
  environment: string
  triggeredBy: string
  startedAt: string
  finishedAt?: string
  duration: string
  buildLogs: string
  steps: Array<{ name: string; status: DeploymentStatus; duration: string }>
}

const STATUS_MAP: Record<DeploymentStatus, { label: string; color: string; icon: React.ElementType; bg: string }> = {
  success: { label: 'Erfolgreich',    color: 'text-emerald-400', icon: CheckCircle2, bg: 'bg-emerald-400/10' },
  failed:  { label: 'Fehlgeschlagen', color: 'text-red-400',     icon: XCircle,      bg: 'bg-red-400/10' },
  running: { label: 'Läuft …',        color: 'text-[#0984e3]',   icon: Activity,     bg: 'bg-[#0984e3]/10' },
  pending: { label: 'Ausstehend',     color: 'text-zinc-400',    icon: Clock,        bg: 'bg-zinc-400/10' },
}

const MOCK_LOGS = `[12:34:01] INFO  Cloning repository…
[12:34:02] INFO  Branch: main  Commit: a3f8c2d
[12:34:05] INFO  Installing dependencies (npm ci)…
[12:34:42] INFO  Running build script (npm run build)…
[12:35:10] INFO  Build complete — 1 547 modules transformed
[12:35:11] INFO  Uploading artifacts…
[12:35:12] INFO  Pulling Docker image…
[12:35:14] INFO  Starting container…
[12:35:15] ✓     Health-check passed (200 OK)
[12:35:15] ✓     Deployment complete in 2m 12s`

function useDeploymentDetail(orgSlug: string, projectId: string, deploymentId: string) {
  return useQuery<DeploymentDetail>({
    queryKey: ['orgs', orgSlug, 'projects', projectId, 'deployments', deploymentId],
    queryFn: async () => {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? ''
      const res = await fetch(
        `${baseUrl}/organizations/${orgSlug}/projects/${projectId}/deployments/${deploymentId}`,
        { credentials: 'include' }
      )
      if (!res.ok) throw new Error('Deployment nicht gefunden')
      return res.json()
    },
    placeholderData: {
      id: deploymentId,
      status: 'success',
      branch: 'main',
      commit: 'a3f8c2d',
      commitMessage: 'fix: improve error handling in auth flow',
      environment: 'production',
      triggeredBy: 'Jason J.',
      startedAt: '12:34:01',
      finishedAt: '12:36:13',
      duration: '2m 12s',
      buildLogs: MOCK_LOGS,
      steps: [
        { name: 'Clone Repository',     status: 'success', duration: '3s' },
        { name: 'Install Dependencies', status: 'success', duration: '37s' },
        { name: 'Build',                status: 'success', duration: '1m 28s' },
        { name: 'Upload Artifacts',     status: 'success', duration: '1s' },
        { name: 'Deploy Container',     status: 'success', duration: '3s' },
      ],
    },
  })
}

export default function DeploymentDetailPage() {
  const { orgSlug, projectId, deploymentId } = useParams<{
    orgSlug: string; projectId: string; deploymentId: string
  }>()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { data: dep, isLoading } = useDeploymentDetail(orgSlug, projectId, deploymentId)
  const [showRollbackConfirm, setShowRollbackConfirm] = useState(false)

  const rollback = useMutation({
    mutationFn: async () => {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? ''
      const res = await fetch(
        `${baseUrl}/organizations/${orgSlug}/projects/${projectId}/deployments/${deploymentId}/rollback`,
        { method: 'POST', credentials: 'include' }
      )
      if (!res.ok) throw new Error('Rollback fehlgeschlagen')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orgs', orgSlug, 'projects', projectId] })
      router.push(`/${orgSlug}/projects/${projectId}/deployments`)
    },
  })

  if (isLoading || !dep) {
    return (
      <div className="space-y-4 p-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl border border-white/[0.06] bg-[#1e272e]" />
        ))}
      </div>
    )
  }

  const cfg = STATUS_MAP[dep.status]
  const StatusIcon = cfg.icon

  return (
    <div className="space-y-6 p-6">
      {/* Back + header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-lg p-1.5 text-zinc-500 hover:bg-white/[0.05] hover:text-zinc-300"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <StatusIcon className={`h-4 w-4 ${cfg.color}`} />
              <span className={`font-medium ${cfg.color}`}>{cfg.label}</span>
              <span className="font-mono text-sm text-zinc-400">{dep.commit}</span>
            </div>
            <p className="mt-0.5 text-xs text-zinc-500">{dep.commitMessage}</p>
          </div>
        </div>

        {dep.status === 'success' && (
          <div className="flex items-center gap-2">
            {showRollbackConfirm ? (
              <>
                <span className="text-sm text-zinc-400">Wirklich zurückrollen?</span>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => rollback.mutate()}
                  disabled={rollback.isPending}
                >
                  {rollback.isPending ? 'Rollback …' : 'Bestätigen'}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowRollbackConfirm(false)}>
                  Abbrechen
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setShowRollbackConfirm(true)}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Rollback
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Meta */}
      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { icon: GitBranch, label: 'Branch',      value: dep.branch },
          { icon: User,      label: 'Ausgelöst von', value: dep.triggeredBy },
          { icon: Clock,     label: 'Gestartet',   value: dep.startedAt },
          { icon: Clock,     label: 'Dauer',        value: dep.duration },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="rounded-xl border border-white/[0.06] bg-[#1e272e] p-4">
            <div className="flex items-center gap-1.5 text-xs text-zinc-500">
              <Icon className="h-3 w-3" />
              {label}
            </div>
            <p className="mt-1 text-sm font-medium text-zinc-200">{value}</p>
          </div>
        ))}
      </div>

      {/* Build Steps Timeline */}
      <div className="rounded-xl border border-white/[0.06] bg-[#1e272e]">
        <div className="border-b border-white/[0.06] px-5 py-4">
          <h2 className="text-sm font-semibold text-zinc-100">Build-Schritte</h2>
        </div>
        <div className="divide-y divide-white/[0.04]">
          {dep.steps.map((step, i) => {
            const sCfg = STATUS_MAP[step.status]
            const SIcon = sCfg.icon
            return (
              <div key={i} className="flex items-center gap-4 px-5 py-3">
                <SIcon className={`h-4 w-4 shrink-0 ${sCfg.color}`} />
                <span className="flex-1 text-sm text-zinc-300">{step.name}</span>
                <span className="font-mono text-xs text-zinc-500">{step.duration}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Build Logs */}
      <div className="rounded-xl border border-white/[0.06] bg-[#1e272e]">
        <div className="flex items-center gap-2 border-b border-white/[0.06] px-5 py-4">
          <Terminal className="h-4 w-4 text-zinc-500" />
          <h2 className="text-sm font-semibold text-zinc-100">Build-Logs</h2>
        </div>
        <pre className="max-h-96 overflow-y-auto p-5 font-mono text-xs leading-relaxed text-zinc-400">
          {dep.buildLogs}
        </pre>
      </div>
    </div>
  )
}
