'use client'

import { PageHeader } from '@/components/layout/page-header'

export default function ProjectsDetailEnvironmentsPage({ params }: { params: { orgSlug: string, projectId: string } }) {
  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Umgebungen"
        description="Liste prod/staging/dev mit Status"
      />
      {/* TODO: Liste prod/staging/dev mit Status */}
    </div>
  )
}
