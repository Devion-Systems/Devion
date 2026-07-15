'use client'

import { PageHeader } from '@/components/layout/page-header'

export default function ProjectsPage({ params }: { params: { orgSlug: string } }) {
  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Projekte"
        description="ProjectTable (TanStack Table) via useProjects(orgId)"
      />
      {/* TODO: ProjectTable (TanStack Table) via useProjects(orgId) */}
    </div>
  )
}
