'use client'

import { PageHeader } from '@/components/layout/page-header'

export default function MembersDetailPage({ params }: { params: { orgSlug: string, userId: string } }) {
  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Mitglied-Detail"
        description="Rollen, Team-Zugehörigkeiten dieses Mitglieds"
      />
      {/* TODO: Rollen, Team-Zugehörigkeiten dieses Mitglieds */}
    </div>
  )
}
