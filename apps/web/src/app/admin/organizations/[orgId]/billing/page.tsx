'use client'

import { PageHeader } from '@/components/layout/page-header'

export default function AdminOrganizationsDetailBillingPage({ params }: { params: { orgId: string } }) {
  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Org-Billing (Admin)"
        description="Zahlungsstatus, Plan dieser Org"
      />
      {/* TODO: Zahlungsstatus, Plan dieser Org */}
    </div>
  )
}
