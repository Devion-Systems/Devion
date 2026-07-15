'use client'

import { PageHeader } from '@/components/layout/page-header'

export default function BillingInvoicesDetailPage({ params }: { params: { orgSlug: string, invoiceId: string } }) {
  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Rechnung"
        description="Rechnungsdetail, Download als PDF"
      />
      {/* TODO: Rechnungsdetail, Download als PDF */}
    </div>
  )
}
