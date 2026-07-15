'use client'

import { PageHeader } from '@/components/layout/page-header'

export default function ProjectsDetailSettingsIntegrationsPage({ params }: { params: { orgSlug: string, projectId: string } }) {
  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Integrationen"
        description="Git-Repo-Connection, Webhooks"
      />
      {/* TODO: Git-Repo-Connection, Webhooks */}
    </div>
  )
}
