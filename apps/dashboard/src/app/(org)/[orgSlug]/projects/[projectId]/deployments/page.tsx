'use client'

import { PageHeader } from '@/components/layout/page-header'

export default function ProjectsDetailDeploymentsPage({ params }: { params: { orgSlug: string, projectId: string } }) {
  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Deployments"
        description="DeploymentTimeline via useProjectDeployments(projectId)"
      />
      {/* TODO: DeploymentTimeline via useProjectDeployments(projectId) */}
    </div>
  )
}
