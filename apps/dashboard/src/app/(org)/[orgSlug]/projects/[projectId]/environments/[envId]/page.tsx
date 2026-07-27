'use client'

import { PageHeader } from '@/components/layout/page-header'

export default function ProjectsDetailEnvironmentsDetailPage({ params }: { params: { orgSlug: string, projectId: string, envId: string } }) {
  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Umgebung-Detail"
        description="Aktueller Deploy-Stand dieser Umgebung"
      />
      {/* TODO: Aktueller Deploy-Stand dieser Umgebung */}
    </div>
  )
}
