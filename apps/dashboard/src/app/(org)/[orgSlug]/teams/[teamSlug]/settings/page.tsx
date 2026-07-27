'use client'

import { PageHeader } from '@/components/layout/page-header'

export default function TeamsDetailSettingsPage({ params }: { params: { orgSlug: string, teamSlug: string } }) {
  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Team-Settings"
        description="Umbenennen, Löschen"
      />
      {/* TODO: Umbenennen, Löschen */}
    </div>
  )
}
