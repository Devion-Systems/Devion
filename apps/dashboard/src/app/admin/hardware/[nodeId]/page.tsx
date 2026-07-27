'use client'

import { PageHeader } from '@/components/layout/page-header'

export default function AdminHardwareDetailPage({ params }: { params: { nodeId: string } }) {
  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Node-Detail (Admin)"
        description="Plattformweite Node-Verwaltung"
      />
      {/* TODO: Plattformweite Node-Verwaltung */}
    </div>
  )
}
