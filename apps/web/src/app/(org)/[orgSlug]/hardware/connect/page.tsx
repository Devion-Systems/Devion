'use client'

import { PageHeader } from '@/components/layout/page-header'

export default function HardwareConnectPage({ params }: { params: { orgSlug: string } }) {
  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Node verbinden"
        description="ConnectNodeWizard — Agent-Setup-Anleitung + Registrierung"
      />
      {/* TODO: ConnectNodeWizard — Agent-Setup-Anleitung + Registrierung */}
    </div>
  )
}
