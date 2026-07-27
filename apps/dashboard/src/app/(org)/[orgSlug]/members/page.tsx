'use client'

import { PageHeader } from '@/components/layout/page-header'

export default function MembersPage({ params }: { params: { orgSlug: string } }) {
  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Mitglieder"
        description="MemberTable via useMembers(orgId)"
      />
      {/* TODO: MemberTable via useMembers(orgId) */}
    </div>
  )
}
