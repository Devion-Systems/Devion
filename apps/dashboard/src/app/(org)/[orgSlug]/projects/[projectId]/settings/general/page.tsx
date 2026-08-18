'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { useQuery, useMutation } from '@tanstack/react-query'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { Save } from 'lucide-react'

type ProjectSettings = {
  name: string
  description: string
  buildCommand: string
  startCommand: string
  rootDirectory: string
  port: number
}

function useProjectSettings(orgSlug: string, projectId: string) {
  return useQuery<ProjectSettings>({
    queryKey: ['orgs', orgSlug, 'projects', projectId, 'settings'],
    queryFn: async () => {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? ''
      const res = await fetch(
        `${baseUrl}/organizations/${orgSlug}/projects/${projectId}/settings`,
        { credentials: 'include' }
      )
      if (!res.ok) throw new Error('Einstellungen nicht verfügbar')
      return res.json()
    },
    placeholderData: {
      name: projectId,
      description: 'Eine Devion-Applikation',
      buildCommand: 'npm run build',
      startCommand: 'npm start',
      rootDirectory: '/',
      port: 3000,
    },
  })
}

function FieldGroup({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-8">
      <div className="sm:w-56 sm:shrink-0">
        <p className="text-sm font-medium text-zinc-200">{label}</p>
        {description && <p className="mt-0.5 text-xs text-zinc-600">{description}</p>}
      </div>
      <div className="flex-1">{children}</div>
    </div>
  )
}

function Input({ value, onChange, type = 'text', placeholder }: {
  value: string | number; onChange: (v: string) => void; type?: string; placeholder?: string
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-9 w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-[#0984e3]/50 focus:outline-none focus:ring-2 focus:ring-[#0984e3]/20"
    />
  )
}

export default function ProjectSettingsGeneralPage() {
  const { orgSlug, projectId } = useParams<{ orgSlug: string; projectId: string }>()
  const { data: settings } = useProjectSettings(orgSlug, projectId)
  const [form, setForm] = useState<Partial<ProjectSettings>>({})

  const values = { ...settings, ...form }
  const set = (key: keyof ProjectSettings) => (v: string) =>
    setForm((prev) => ({ ...prev, [key]: v }))

  const save = useMutation({
    mutationFn: async () => {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? ''
      const res = await fetch(
        `${baseUrl}/organizations/${orgSlug}/projects/${projectId}/settings`,
        { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) }
      )
      if (!res.ok) throw new Error('Speichern fehlgeschlagen')
    },
  })

  return (
    <div className="space-y-8">
      <PageHeader title="Allgemeine Einstellungen" />

      <div className="space-y-6 divide-y divide-white/[0.06]">
        <FieldGroup label="Projektname">
          <Input value={values.name ?? ''} onChange={set('name')} />
        </FieldGroup>
        <div className="pt-6">
          <FieldGroup label="Beschreibung" description="Kurze Beschreibung des Projekts">
            <Input value={values.description ?? ''} onChange={set('description')} placeholder="Meine Anwendung" />
          </FieldGroup>
        </div>
        <div className="pt-6">
          <FieldGroup label="Build-Befehl" description="Wird vor dem Start ausgeführt">
            <Input value={values.buildCommand ?? ''} onChange={set('buildCommand')} placeholder="npm run build" />
          </FieldGroup>
        </div>
        <div className="pt-6">
          <FieldGroup label="Start-Befehl" description="Startet die Anwendung">
            <Input value={values.startCommand ?? ''} onChange={set('startCommand')} placeholder="npm start" />
          </FieldGroup>
        </div>
        <div className="pt-6">
          <FieldGroup label="Root-Verzeichnis" description="Pfad relativ zum Repository-Root">
            <Input value={values.rootDirectory ?? ''} onChange={set('rootDirectory')} placeholder="/" />
          </FieldGroup>
        </div>
        <div className="pt-6">
          <FieldGroup label="Port" description="Der Port, auf dem die App lauscht">
            <Input value={values.port ?? ''} onChange={set('port')} type="number" placeholder="3000" />
          </FieldGroup>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={() => save.mutate()} disabled={save.isPending} className="gap-1.5">
          <Save className="h-3.5 w-3.5" />
          {save.isPending ? 'Speichere …' : 'Speichern'}
        </Button>
      </div>
    </div>
  )
}
