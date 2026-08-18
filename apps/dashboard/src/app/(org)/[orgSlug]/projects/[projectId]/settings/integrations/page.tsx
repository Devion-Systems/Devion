'use client'

import { useState } from 'react'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { GitBranch, Webhook, Check, Plus } from 'lucide-react'

export default function ProjectSettingsIntegrationsPage() {
  const [gitConnected, setGitConnected] = useState(true)
  const [webhookUrl, setWebhookUrl] = useState('')

  return (
    <div className="space-y-6">
      <PageHeader title="Integrationen" description="Git-Provider und Webhooks konfigurieren" />

      <div className="rounded-xl border border-white/[0.06] bg-[#1e272e] p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <GitBranch className="mt-0.5 h-5 w-5 text-zinc-400" />
            <div>
              <p className="font-medium text-zinc-100">Git-Repository</p>
              <p className="mt-0.5 text-sm text-zinc-500">
                {gitConnected ? 'github.com/org/repo' : 'Kein Repository verbunden'}
              </p>
            </div>
          </div>
          {gitConnected ? (
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-400/10 px-2.5 py-1 text-xs text-emerald-400">
              <Check className="h-3 w-3" />
              Verbunden
            </span>
          ) : (
            <Button size="sm" onClick={() => setGitConnected(true)}>Verbinden</Button>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-white/[0.06] bg-[#1e272e] p-5">
        <div className="flex items-start gap-3">
          <Webhook className="mt-0.5 h-5 w-5 text-zinc-400" />
          <div className="flex-1">
            <p className="font-medium text-zinc-100">Webhooks</p>
            <p className="mt-0.5 text-sm text-zinc-500">Wird nach jedem Deployment aufgerufen</p>
            <div className="mt-3 flex gap-2">
              <input
                type="text"
                placeholder="https://example.com/webhook"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                className="h-8 flex-1 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-[#0984e3]/50 focus:outline-none"
              />
              <Button size="sm" variant="outline" className="gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                Hinzufügen
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
