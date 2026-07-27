'use client'

import { PageHeader } from '@/components/layout/page-header'

export default function DatabasesDetailLogsPage({ params }: { params: { orgSlug: string, databaseId: string } }) {
  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Datenbank-Logs"
        description="Connection-Errors, Slow-Query-Log"
      />
      {/* TODO: Connection-Errors, Slow-Query-Log */}
    </div>
  )
}
