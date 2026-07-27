'use client'

import { PageHeader } from '@/components/layout/page-header'

export default function SettingsIntegrationsPage({ params }: { params: { orgSlug: string } }) {
  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Integrationen"
        description="Git-Provider, globale Webhooks"
      />
      {/* TODO: Git-Provider, globale Webhooks */}
    </div>
  )
}
