'use client'

import { PageHeader } from '@/components/layout/page-header'

export default function BillingPlansPage({ params }: { params: { orgSlug: string } }) {
  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Pläne"
        description="PlanCard-Grid, Upgrade/Downgrade-Flow"
      />
      {/* TODO: PlanCard-Grid, Upgrade/Downgrade-Flow */}
    </div>
  )
}
