'use client'

import { PageHeader } from '@/components/layout/page-header'

export default function ProjectsDetailPage({ params }: { params: { orgSlug: string, projectId: string } }) {
  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Projekt-Übersicht"
        description="Status, letzter Deploy, Quick-Actions (Deploy, Rollback)"
      />
      {/* TODO: Status, letzter Deploy, Quick-Actions (Deploy, Rollback) */}
    </div>
  )
}
