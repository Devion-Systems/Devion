'use client'

import { PageHeader } from '@/components/layout/page-header'

export default function TeamsDetailProjectsPage({ params }: { params: { orgSlug: string, teamSlug: string } }) {
  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Team-Projekte"
        description="Nur Projekte dieses Teams, gefilterte ProjectTable"
      />
      {/* TODO: Nur Projekte dieses Teams, gefilterte ProjectTable */}
    </div>
  )
}
