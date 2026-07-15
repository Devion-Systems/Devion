'use client'

import { PageHeader } from '@/components/layout/page-header'

export default function TeamsNewPage({ params }: { params: { orgSlug: string } }) {
  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Neues Team"
        description="CreateTeamDialog-Inhalt als eigene Seite"
      />
      {/* TODO: CreateTeamDialog-Inhalt als eigene Seite */}
    </div>
  )
}
