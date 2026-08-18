'use client'

import { useParams } from 'next/navigation'
import { PageHeader } from '@/components/layout/page-header'
import { Button } from '@/components/ui/button'
import { ShieldCheck, Plus, User, X } from 'lucide-react'

const MOCK_ACCESS = [
  { id: '1', name: 'Jason Janzen',  email: 'jason@example.com',  role: 'Owner' },
  { id: '2', name: 'Sarah König',   email: 'sarah@example.com',  role: 'Admin' },
  { id: '3', name: 'Tom Müller',    email: 'tom@example.com',    role: 'Developer' },
]

export default function ProjectSettingsAccessPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Zugriff" description="Wer kann dieses Projekt sehen und deployen" />

      <div className="rounded-xl border border-white/[0.06] bg-[#1e272e]">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <p className="text-sm font-semibold text-zinc-100">Mitglieder mit Zugriff</p>
          <Button size="sm" variant="outline" className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Hinzufügen
          </Button>
        </div>
        <div className="divide-y divide-white/[0.04]">
          {MOCK_ACCESS.map((m) => (
            <div key={m.id} className="flex items-center gap-4 px-5 py-3.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0984e3]/20 text-xs font-semibold text-[#0984e3]">
                {m.name.charAt(0)}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-zinc-200">{m.name}</p>
                <p className="text-xs text-zinc-500">{m.email}</p>
              </div>
              <span className="rounded-full border border-white/[0.06] px-2.5 py-0.5 text-xs text-zinc-400">
                {m.role}
              </span>
              <button type="button" className="rounded p-1 text-zinc-600 hover:bg-red-400/10 hover:text-red-400">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
