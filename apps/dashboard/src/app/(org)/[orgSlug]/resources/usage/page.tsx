'use client'

import { PageHeader } from '@/components/layout/page-header'

export default function ResourcesUsagePage({ params }: { params: { orgSlug: string } }) {
  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Ressourcennutzung"
        description="Aggregierte Nutzung über alle Ressourcentypen (Compute + DB)"
      />
      {/* TODO: Aggregierte Nutzung über alle Ressourcentypen (Compute + DB) */}
    </div>
  )
}
