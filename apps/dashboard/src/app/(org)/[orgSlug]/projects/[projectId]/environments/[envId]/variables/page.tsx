'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Plus, Eye, EyeOff, Trash2, Save, Lock, ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

type EnvVar = {
  key: string
  value: string
  isSecret: boolean
}

const PLACEHOLDER_VARS: EnvVar[] = [
  { key: 'DATABASE_URL',       value: 'postgresql://user:pass@db:5432/app', isSecret: true  },
  { key: 'REDIS_URL',          value: 'redis://cache:6379',                 isSecret: true  },
  { key: 'JWT_SECRET',         value: 'supersecretvalue',                   isSecret: true  },
  { key: 'NODE_ENV',           value: 'production',                         isSecret: false },
  { key: 'PORT',               value: '3000',                               isSecret: false },
  { key: 'LOG_LEVEL',          value: 'info',                               isSecret: false },
  { key: 'API_BASE_URL',       value: 'https://api.example.com',            isSecret: false },
  { key: 'S3_BUCKET',          value: 'my-app-assets',                      isSecret: false },
]

function useEnvVars(orgSlug: string, projectId: string, envId: string) {
  return useQuery<EnvVar[]>({
    queryKey: ['orgs', orgSlug, 'projects', projectId, 'environments', envId, 'variables'],
    queryFn: async () => {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? ''
      const res = await fetch(
        `${baseUrl}/organizations/${orgSlug}/projects/${projectId}/environments/${envId}/variables`,
        { credentials: 'include' }
      )
      if (!res.ok) throw new Error('Variablen nicht verfügbar')
      return res.json()
    },
    placeholderData: PLACEHOLDER_VARS,
  })
}

function VarRow({
  envVar,
  onDelete,
}: {
  envVar: EnvVar
  onDelete: (key: string) => void
}) {
  const [revealed, setRevealed] = useState(false)
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(envVar.value)

  const displayValue = envVar.isSecret && !revealed
    ? '••••••••••••'
    : value

  return (
    <div className="group flex items-center gap-3 rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2.5 transition-colors hover:border-white/[0.1]">
      {/* Key */}
      <div className="flex items-center gap-1.5 w-52 shrink-0">
        {envVar.isSecret && <Lock className="h-3 w-3 shrink-0 text-[#0984e3]" />}
        <span className="font-mono text-sm text-zinc-300">{envVar.key}</span>
      </div>

      {/* Value */}
      <div className="flex-1 min-w-0">
        {editing ? (
          <input
            autoFocus
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={() => setEditing(false)}
            onKeyDown={(e) => e.key === 'Enter' && setEditing(false)}
            className="w-full rounded border border-[#0984e3]/40 bg-[#0984e3]/5 px-2 py-0.5 font-mono text-sm text-zinc-200 focus:outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="w-full text-left font-mono text-sm text-zinc-400 hover:text-zinc-200"
          >
            {displayValue}
          </button>
        )}
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        {envVar.isSecret && (
          <button
            type="button"
            onClick={() => setRevealed(!revealed)}
            className="rounded p-1 text-zinc-500 hover:bg-white/[0.05] hover:text-zinc-300"
          >
            {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
        )}
        <button
          type="button"
          onClick={() => onDelete(envVar.key)}
          className="rounded p-1 text-zinc-600 hover:bg-red-400/10 hover:text-red-400"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

export default function EnvironmentVariablesPage() {
  const { orgSlug, projectId, envId } = useParams<{
    orgSlug: string; projectId: string; envId: string
  }>()
  const queryClient = useQueryClient()
  const { data: vars = [], isLoading } = useEnvVars(orgSlug, projectId, envId)
  const [newKey, setNewKey] = useState('')
  const [newValue, setNewValue] = useState('')
  const [newIsSecret, setNewIsSecret] = useState(false)
  const [showNewRow, setShowNewRow] = useState(false)
  const [search, setSearch] = useState('')

  const filtered = vars.filter((v) =>
    v.key.toLowerCase().includes(search.toLowerCase())
  )

  function handleDelete(key: string) {
    queryClient.setQueryData<EnvVar[]>(
      ['orgs', orgSlug, 'projects', projectId, 'environments', envId, 'variables'],
      (old) => (old ?? []).filter((v) => v.key !== key)
    )
  }

  function handleAdd() {
    if (!newKey.trim()) return
    queryClient.setQueryData<EnvVar[]>(
      ['orgs', orgSlug, 'projects', projectId, 'environments', envId, 'variables'],
      (old) => [...(old ?? []), { key: newKey.trim(), value: newValue, isSecret: newIsSecret }]
    )
    setNewKey('')
    setNewValue('')
    setNewIsSecret(false)
    setShowNewRow(false)
  }

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Umgebungsvariablen"
        description={`${vars.length} Variablen in ${envId}`}
      />

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder="Suchen …"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 flex-1 max-w-xs rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-[#0984e3]/50 focus:outline-none focus:ring-2 focus:ring-[#0984e3]/20"
        />
        <Button size="sm" className="gap-1.5 ml-auto" onClick={() => setShowNewRow(true)}>
          <Plus className="h-3.5 w-3.5" />
          Variable hinzufügen
        </Button>
        <Button size="sm" variant="outline" className="gap-1.5">
          <Save className="h-3.5 w-3.5" />
          Speichern & Deploy
        </Button>
      </div>

      {/* Variable List */}
      <div className="rounded-xl border border-white/[0.06] bg-[#1e272e] p-4">
        {/* Header */}
        <div className="mb-2 flex items-center gap-3 px-3 text-[10px] uppercase tracking-wide text-zinc-600">
          <span className="w-52 shrink-0">Schlüssel</span>
          <span className="flex-1">Wert</span>
        </div>

        {/* New variable row */}
        {showNewRow && (
          <div className="mb-2 flex items-center gap-3 rounded-lg border border-[#0984e3]/30 bg-[#0984e3]/5 px-3 py-2.5">
            <div className="flex items-center gap-1.5 w-52 shrink-0">
              <button
                type="button"
                onClick={() => setNewIsSecret(!newIsSecret)}
                className={cn(
                  'rounded p-0.5 transition-colors',
                  newIsSecret ? 'text-[#0984e3]' : 'text-zinc-600 hover:text-zinc-400'
                )}
                title="Als Secret markieren"
              >
                <Lock className="h-3 w-3" />
              </button>
              <input
                autoFocus
                placeholder="VARIABLE_NAME"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value.toUpperCase().replace(/\s/g, '_'))}
                className="w-full bg-transparent font-mono text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none"
              />
            </div>
            <input
              placeholder="Wert …"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              type={newIsSecret ? 'password' : 'text'}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              className="flex-1 bg-transparent font-mono text-sm text-zinc-300 placeholder:text-zinc-600 focus:outline-none"
            />
            <div className="flex shrink-0 gap-1.5">
              <Button size="xs" onClick={handleAdd}>Hinzufügen</Button>
              <Button size="xs" variant="ghost" onClick={() => setShowNewRow(false)}>Abbrechen</Button>
            </div>
          </div>
        )}

        {/* Variables */}
        <div className="space-y-1.5">
          {isLoading ? (
            [...Array(6)].map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded-lg bg-white/[0.03]" />
            ))
          ) : filtered.length === 0 ? (
            <div className="py-8 text-center text-sm text-zinc-600">
              Keine Variablen gefunden
            </div>
          ) : (
            filtered.map((v) => (
              <VarRow key={v.key} envVar={v} onDelete={handleDelete} />
            ))
          )}
        </div>
      </div>
    </div>
  )
}
