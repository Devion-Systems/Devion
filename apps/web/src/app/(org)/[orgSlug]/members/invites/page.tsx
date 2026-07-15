'use client'

import { PageHeader } from '@/components/layout/page-header'

export default function MembersInvitesPage({ params }: { params: { orgSlug: string } }) {
  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Ausstehende Einladungen"
        description="useInvites(orgId), Widerrufen-Aktion"
      />
      {/* TODO: useInvites(orgId), Widerrufen-Aktion */}
    </div>
  )
}
