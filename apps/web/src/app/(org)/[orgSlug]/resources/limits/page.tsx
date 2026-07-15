'use client'

import { PageHeader } from '@/components/layout/page-header'

export default function ResourcesLimitsPage({ params }: { params: { orgSlug: string } }) {
  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Ressourcen-Limits"
        description="QuotaBar je Org/Team/Projekt via useLimits(orgId)"
      />
      {/* TODO: QuotaBar je Org/Team/Projekt via useLimits(orgId) */}
    </div>
  )
}
