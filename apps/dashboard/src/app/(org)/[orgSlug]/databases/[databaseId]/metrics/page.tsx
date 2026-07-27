'use client'

import { PageHeader } from '@/components/layout/page-header'

export default function DatabasesDetailMetricsPage({ params }: { params: { orgSlug: string, databaseId: string } }) {
  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Datenbank-Metriken"
        description="Connections, Query-Rate, Storage-Wachstum, Slow-Queries"
      />
      {/* TODO: Connections, Query-Rate, Storage-Wachstum, Slow-Queries */}
    </div>
  )
}
