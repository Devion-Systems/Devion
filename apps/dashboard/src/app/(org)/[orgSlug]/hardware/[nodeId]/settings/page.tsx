'use client'

import { PageHeader } from '@/components/layout/page-header'

export default function HardwareDetailSettingsPage({ params }: { params: { orgSlug: string, nodeId: string } }) {
  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Node-Settings"
        description="Limits für diesen Node, Wartungsmodus"
      />
      {/* TODO: Limits für diesen Node, Wartungsmodus */}
    </div>
  )
}
