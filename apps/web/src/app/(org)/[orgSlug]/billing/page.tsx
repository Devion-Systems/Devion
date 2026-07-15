'use client'

import { PageHeader } from '@/components/layout/page-header'

export default function BillingPage({ params }: { params: { orgSlug: string } }) {
  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Abrechnung"
        description="Aktueller Plan, Zahlungsmethode, InvoiceTable-Preview"
      />
      {/* TODO: Aktueller Plan, Zahlungsmethode, InvoiceTable-Preview */}
    </div>
  )
}
