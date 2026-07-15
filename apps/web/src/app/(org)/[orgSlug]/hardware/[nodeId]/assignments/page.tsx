'use client'

import { PageHeader } from '@/components/layout/page-header'

export default function HardwareDetailAssignmentsPage({ params }: { params: { orgSlug: string, nodeId: string } }) {
  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Zuweisungen"
        description="Welche Projekte/Datenbanken laufen auf diesem Node"
      />
      {/* TODO: Welche Projekte/Datenbanken laufen auf diesem Node */}
    </div>
  )
}
