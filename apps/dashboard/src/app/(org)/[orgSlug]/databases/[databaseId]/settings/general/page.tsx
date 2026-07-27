'use client'

import { PageHeader } from '@/components/layout/page-header'

export default function DatabasesDetailSettingsGeneralPage({ params }: { params: { orgSlug: string, databaseId: string } }) {
  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Allgemein"
        description="Name, Version-Upgrade, Maintenance-Window"
      />
      {/* TODO: Name, Version-Upgrade, Maintenance-Window */}
    </div>
  )
}
