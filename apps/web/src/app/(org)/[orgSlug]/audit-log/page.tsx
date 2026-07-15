'use client'

import { PageHeader } from '@/components/layout/page-header'

export default function AuditLogPage({ params }: { params: { orgSlug: string } }) {
  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Audit Log"
        description="LogTable via useAuditLogs(orgId), LogDetailDrawer bei Klick"
      />
      {/* TODO: LogTable via useAuditLogs(orgId), LogDetailDrawer bei Klick */}
    </div>
  )
}
