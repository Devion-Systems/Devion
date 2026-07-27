'use client'

import { PageHeader } from '@/components/layout/page-header'

export default function ProjectsDetailMetricsPage({ params }: { params: { orgSlug: string, projectId: string } }) {
  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Metriken"
        description="MetricsChart (Recharts) für CPU/RAM/Traffic dieses Projekts"
      />
      {/* TODO: MetricsChart (Recharts) für CPU/RAM/Traffic dieses Projekts */}
    </div>
  )
}
