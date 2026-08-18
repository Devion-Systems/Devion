'use client'

import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import {
  CheckCircle2,
  Globe,
  GitBranch,
  Clock,
  Lock,
  Rocket,
  BarChart2,
  ChevronRight,
} from 'lucide-react'

type EnvDetail = {
  id: string
  name: string
  displayName: string
  domain?: string
  branch: string
  status: 'active' | 'failing' | 'idle'
  lastDeploy: string
  commitHash: string
  commitMessage: string
  uptime: string
  variableCount: number
  replicas: number
}

function useEnvironmentDetail(orgSlug: string, projectId: string, envId: string) {
  return useQuery<EnvDetail>({
    queryKey: ['orgs', orgSlug, 'projects', projectId, 'environments', envId],
    queryFn: async () => {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? ''
      const res = await fetch(
        `${baseUrl}/organizations/${orgSlug}/projects/${projectId}/environments/${envId}`,
        { credentials: 'include' }
      )
      if (!res.ok) throw new Error('Umgebung nicht gefunden')
      return res.json()
    },
    placeholderData: {
      id: envId,
      name: 'production',
      displayName: 'Production',
      domain: 'app.example.com',
      branch: 'main',
      status: 'active',
      lastDeploy: 'Vor 5 Min.',
      commitHash: 'a3f8c2d',
      commitMessage: 'fix: improve error handling in auth flow',
      uptime: '99.98%',
      variableCount: 24,
      replicas: 2,
    },
  })
}

export default function EnvironmentDetailPage() {
  const { orgSlug, projectId, envId } = useParams<{
    orgSlug: string; projectId: string; envId: string
  }>()
  const router = useRouter()
  const { data: env, isLoading } = useEnvironmentDetail(orgSlug, projectId, envId)

  if (isLoading || !env) {
    return (
      <div className="space-y-4 p-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl border border-white/[0.06] bg-[#1e272e]" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <PageHeader
          title={env.displayName}
          description={`Aktueller Deploy-Stand und Konfiguration`}
        />
        <Button
          size="sm"
          className="gap-1.5"
          onClick={() => router.push(`/${orgSlug}/projects/${projectId}/deployments`)}
        >
          <Rocket className="h-3.5 w-3.5" />
          Deploy
        </Button>
      </div>

      {/* Status-Karten */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { icon: CheckCircle2, label: 'Status',       value: env.status === 'active' ? 'Aktiv' : 'Fehler', color: env.status === 'active' ? 'text-emerald-400' : 'text-red-400' },
          { icon: Clock,        label: 'Letzter Deploy', value: env.lastDeploy },
          { icon: BarChart2,    label: 'Uptime',        value: env.uptime },
          { icon: Globe,        label: 'Replicas',      value: `${env.replicas}x` },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="rounded-xl border border-white/[0.06] bg-[#1e272e] p-4">
            <div className="flex items-center gap-1.5 text-xs text-zinc-500">
              <Icon className="h-3 w-3" />
              {label}
            </div>
            <p className={`mt-1.5 text-sm font-semibold ${color ?? 'text-zinc-200'}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Aktueller Commit */}
      <div className="rounded-xl border border-white/[0.06] bg-[#1e272e] p-5">
        <h2 className="mb-4 text-sm font-semibold text-zinc-100">Aktuell deployt</h2>
        <div className="flex items-start gap-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-400/10">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm text-zinc-200">{env.commitHash}</span>
              <span className="rounded border border-white/[0.06] px-1.5 py-0.5 text-[10px] text-zinc-500">
                {env.branch}
              </span>
            </div>
            <p className="mt-1 text-sm text-zinc-400">{env.commitMessage}</p>
          </div>
        </div>
      </div>

      {/* Shortcuts */}
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => router.push(`/${orgSlug}/projects/${projectId}/environments/${envId}/variables`)}
          className="group flex items-center justify-between rounded-xl border border-white/[0.06] bg-[#1e272e] p-4 text-left transition-all hover:border-white/[0.12] hover:bg-[#222e38]"
        >
          <div className="flex items-center gap-3">
            <Lock className="h-4 w-4 text-zinc-400" />
            <div>
              <p className="text-sm font-medium text-zinc-200">Umgebungsvariablen</p>
              <p className="text-xs text-zinc-500">{env.variableCount} Variablen konfiguriert</p>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-zinc-700 transition-transform group-hover:translate-x-0.5" />
        </button>
        <button
          type="button"
          onClick={() => router.push(`/${orgSlug}/projects/${projectId}/domains`)}
          className="group flex items-center justify-between rounded-xl border border-white/[0.06] bg-[#1e272e] p-4 text-left transition-all hover:border-white/[0.12] hover:bg-[#222e38]"
        >
          <div className="flex items-center gap-3">
            <Globe className="h-4 w-4 text-zinc-400" />
            <div>
              <p className="text-sm font-medium text-zinc-200">Domain</p>
              <p className="text-xs text-zinc-500">{env.domain ?? 'Kein Domain konfiguriert'}</p>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-zinc-700 transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>
    </div>
  )
}
