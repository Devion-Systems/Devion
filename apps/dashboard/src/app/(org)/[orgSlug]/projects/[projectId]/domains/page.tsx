'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Globe, Lock, LockOpen, Plus, Trash2, CheckCircle2, Clock, AlertTriangle, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

type DomainStatus = 'active' | 'pending' | 'failed'

type Domain = {
  id: string
  domain: string
  environment: string
  status: DomainStatus
  sslExpiry?: string
  isCustom: boolean
  addedAt: string
}

const STATUS_MAP: Record<DomainStatus, { label: string; color: string; icon: React.ElementType }> = {
  active:  { label: 'Aktiv',         color: 'text-emerald-400', icon: CheckCircle2 },
  pending: { label: 'DNS ausstehend',color: 'text-amber-400',   icon: Clock },
  failed:  { label: 'Fehler',        color: 'text-red-400',     icon: AlertTriangle },
}

function useDomains(orgSlug: string, projectId: string) {
  return useQuery<Domain[]>({
    queryKey: ['orgs', orgSlug, 'projects', projectId, 'domains'],
    queryFn: async () => {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? ''
      const res = await fetch(
        `${baseUrl}/organizations/${orgSlug}/projects/${projectId}/domains`,
        { credentials: 'include' }
      )
      if (!res.ok) throw new Error('Domains nicht verfügbar')
      return res.json()
    },
    placeholderData: [
      { id: 'd1', domain: 'app.example.com',         environment: 'production', status: 'active',  sslExpiry: '2027-03-15', isCustom: true,  addedAt: '2025-12-01' },
      { id: 'd2', domain: 'api.example.com',         environment: 'production', status: 'active',  sslExpiry: '2027-03-15', isCustom: true,  addedAt: '2025-12-01' },
      { id: 'd3', domain: 'staging.example.com',     environment: 'staging',    status: 'pending', isCustom: true,  addedAt: '2026-08-17' },
      { id: 'd4', domain: 'myproject.devion.app',    environment: 'production', status: 'active',  sslExpiry: '2027-08-01', isCustom: false, addedAt: '2025-11-20' },
    ],
  })
}

export default function DomainsPage() {
  const { orgSlug, projectId } = useParams<{ orgSlug: string; projectId: string }>()
  const queryClient = useQueryClient()
  const { data: domains = [], isLoading } = useDomains(orgSlug, projectId)
  const [newDomain, setNewDomain] = useState('')
  const [newEnv, setNewEnv] = useState('production')
  const [showAdd, setShowAdd] = useState(false)

  function handleAdd() {
    if (!newDomain.trim()) return
    const newEntry: Domain = {
      id: `tmp-${Date.now()}`,
      domain: newDomain.trim(),
      environment: newEnv,
      status: 'pending',
      isCustom: true,
      addedAt: new Date().toISOString().slice(0, 10),
    }
    queryClient.setQueryData<Domain[]>(
      ['orgs', orgSlug, 'projects', projectId, 'domains'],
      (old) => [...(old ?? []), newEntry]
    )
    setNewDomain('')
    setShowAdd(false)
  }

  function handleDelete(id: string) {
    queryClient.setQueryData<Domain[]>(
      ['orgs', orgSlug, 'projects', projectId, 'domains'],
      (old) => (old ?? []).filter((d) => d.id !== id)
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <PageHeader
          title="Domains"
          description="Custom-Domains und SSL-Zertifikate"
        />
        <Button size="sm" className="gap-1.5" onClick={() => setShowAdd(true)}>
          <Plus className="h-3.5 w-3.5" />
          Domain hinzufügen
        </Button>
      </div>

      {/* Add Domain Form */}
      {showAdd && (
        <div className="flex items-center gap-3 rounded-xl border border-[#0984e3]/30 bg-[#0984e3]/5 p-4">
          <Globe className="h-4 w-4 shrink-0 text-zinc-400" />
          <input
            autoFocus
            type="text"
            placeholder="meine-domain.com"
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            className="flex-1 bg-transparent text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none"
          />
          <select
            value={newEnv}
            onChange={(e) => setNewEnv(e.target.value)}
            className="rounded-lg border border-white/[0.08] bg-[#1e272e] px-2.5 py-1 text-xs text-zinc-300 focus:outline-none"
          >
            <option value="production">Production</option>
            <option value="staging">Staging</option>
            <option value="dev">Dev</option>
          </select>
          <Button size="xs" onClick={handleAdd}>Hinzufügen</Button>
          <Button size="xs" variant="ghost" onClick={() => setShowAdd(false)}>Abbrechen</Button>
        </div>
      )}

      {/* Domain List */}
      <div className="rounded-xl border border-white/[0.06] bg-[#1e272e]">
        {isLoading ? (
          <div className="divide-y divide-white/[0.04]">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-16 animate-pulse px-5 py-4" />
            ))}
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {domains.map((dom) => {
              const cfg = STATUS_MAP[dom.status]
              const Icon = cfg.icon
              return (
                <div key={dom.id} className="group flex items-center gap-4 px-5 py-4">
                  {/* Status icon */}
                  <Icon className={`h-4 w-4 shrink-0 ${cfg.color}`} />

                  {/* Domain info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-zinc-100">{dom.domain}</span>
                      {!dom.isCustom && (
                        <span className="rounded-full border border-white/[0.08] px-1.5 py-0.5 text-[10px] text-zinc-500">
                          Devion
                        </span>
                      )}
                      <span className="rounded border border-white/[0.06] px-1.5 py-0.5 text-[10px] text-zinc-500">
                        {dom.environment}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-3 text-xs text-zinc-600">
                      <span className={cfg.color}>{cfg.label}</span>
                      {dom.sslExpiry && (
                        <span className="flex items-center gap-1">
                          <Lock className="h-3 w-3 text-emerald-400" />
                          SSL bis {dom.sslExpiry}
                        </span>
                      )}
                      {!dom.sslExpiry && dom.status !== 'pending' && (
                        <span className="flex items-center gap-1 text-amber-400">
                          <LockOpen className="h-3 w-3" />
                          Kein SSL
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  {dom.isCustom && (
                    <button
                      type="button"
                      onClick={() => handleDelete(dom.id)}
                      className="rounded p-1.5 text-zinc-600 opacity-0 transition-opacity hover:bg-red-400/10 hover:text-red-400 group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}

                  {dom.status === 'pending' && (
                    <button
                      type="button"
                      className="flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-[11px] text-amber-400 hover:bg-amber-400/20"
                    >
                      <RefreshCw className="h-3 w-3" />
                      DNS prüfen
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* DNS-Hinweis */}
      <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-4">
        <p className="text-sm font-medium text-amber-300">DNS-Konfiguration</p>
        <p className="mt-1 text-xs text-zinc-500">
          Richte bei deinem DNS-Provider einen <span className="font-mono text-zinc-300">CNAME</span>-Eintrag auf{' '}
          <span className="font-mono text-zinc-300">proxy.devion.app</span> oder einen{' '}
          <span className="font-mono text-zinc-300">A</span>-Eintrag auf{' '}
          <span className="font-mono text-zinc-300">185.199.108.1</span> ein.
        </p>
      </div>
    </div>
  )
}
