'use client'

import { PageHeader } from '@/components/layout/page-header'

export default function DatabasesDetailSettingsNetworkingPage({ params }: { params: { orgSlug: string, databaseId: string } }) {
  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Netzwerk"
        description="Public/Private Access, IP-Allowlist, SSL-Modus"
      />
      {/* TODO: Public/Private Access, IP-Allowlist, SSL-Modus */}
    </div>
  )
}
