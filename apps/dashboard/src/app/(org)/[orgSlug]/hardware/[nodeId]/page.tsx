'use client'

import { PageHeader } from '@/components/layout/page-header'

export default function HardwareDetailPage({ params }: { params: { orgSlug: string, nodeId: string } }) {
  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Node-Detail"
        description="Status, Specs, NodeHealthBadge"
      />
      {/* TODO: Status, Specs, NodeHealthBadge */}
    </div>
  )
}
