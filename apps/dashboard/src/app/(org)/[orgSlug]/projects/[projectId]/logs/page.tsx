'use client'

import { PageHeader } from '@/components/layout/page-header'

export default function ProjectsDetailLogsPage({ params }: { params: { orgSlug: string, projectId: string } }) {
  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Logs"
        description="LogViewer mit LogFilterBar, Live-Streaming (Polling/SSE offen)"
      />
      {/* TODO: LogViewer mit LogFilterBar, Live-Streaming (Polling/SSE offen) */}
    </div>
  )
}
