'use client'

import { PageHeader } from '@/components/layout/page-header'

export default function HardwareDetailResourcesPage({ params }: { params: { orgSlug: string, nodeId: string } }) {
  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Node-Ressourcen"
        description="ResourceGauge für CPU/RAM/Storage-Auslastung"
      />
      {/* TODO: ResourceGauge für CPU/RAM/Storage-Auslastung */}
    </div>
  )
}
