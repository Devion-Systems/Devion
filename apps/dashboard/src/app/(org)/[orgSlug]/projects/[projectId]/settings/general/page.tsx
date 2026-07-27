'use client'

import { PageHeader } from '@/components/layout/page-header'

export default function ProjectsDetailSettingsGeneralPage({ params }: { params: { orgSlug: string, projectId: string } }) {
  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Allgemein"
        description="Name, Beschreibung, Team-Zuordnung"
      />
      {/* TODO: Name, Beschreibung, Team-Zuordnung */}
    </div>
  )
}
