'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useMutation } from '@tanstack/react-query'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { AlertTriangle, Trash2 } from 'lucide-react'

export default function ProjectSettingsDangerZonePage() {
  const { orgSlug, projectId } = useParams<{ orgSlug: string; projectId: string }>()
  const router = useRouter()
  const [confirm, setConfirm] = useState('')
  const [step, setStep] = useState<'idle' | 'confirm'>('idle')

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? ''
      const res = await fetch(
        `${baseUrl}/organizations/${orgSlug}/projects/${projectId}`,
        { method: 'DELETE', credentials: 'include' }
      )
      if (!res.ok) throw new Error('Löschen fehlgeschlagen')
    },
    onSuccess: () => router.replace(`/${orgSlug}/projects`),
  })

  return (
    <div className="space-y-6">
      <PageHeader title="Danger Zone" description="Irreversible Aktionen – mit Vorsicht verwenden" />

      <div className="rounded-xl border border-red-400/20 bg-red-400/5 p-5">
        <div className="flex items-start gap-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
          <div className="flex-1">
            <p className="font-medium text-zinc-100">Projekt löschen</p>
            <p className="mt-1 text-sm text-zinc-400">
              Das Projekt wird dauerhaft gelöscht, inklusive aller Deployments, Logs und Einstellungen.
              Diese Aktion kann nicht rückgängig gemacht werden.
            </p>
            {step === 'idle' ? (
              <Button
                variant="destructive"
                size="sm"
                className="mt-4 gap-1.5"
                onClick={() => setStep('confirm')}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Projekt löschen
              </Button>
            ) : (
              <div className="mt-4 space-y-3">
                <p className="text-sm text-zinc-400">
                  Gib <span className="font-mono font-semibold text-zinc-200">{projectId}</span> ein, um zu bestätigen:
                </p>
                <input
                  type="text"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder={projectId}
                  className="h-9 w-full max-w-xs rounded-lg border border-red-400/30 bg-red-400/5 px-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-red-400/60 focus:outline-none"
                />
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={confirm !== projectId || deleteMutation.isPending}
                    onClick={() => deleteMutation.mutate()}
                  >
                    {deleteMutation.isPending ? 'Lösche …' : 'Endgültig löschen'}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => { setStep('idle'); setConfirm('') }}>
                    Abbrechen
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
