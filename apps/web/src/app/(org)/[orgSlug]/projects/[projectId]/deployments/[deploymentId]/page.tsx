'use client'

import { PageHeader } from '@/components/layout/page-header'

export default function ProjectsDetailDeploymentsDetailPage({ params }: { params: { orgSlug: string, projectId: string, deploymentId: string } }) {
  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Deployment-Detail"
        description="BuildLogViewer, Status, RollbackDialog"
      />
      {/* TODO: BuildLogViewer, Status, RollbackDialog */}
    </div>
  )
}
