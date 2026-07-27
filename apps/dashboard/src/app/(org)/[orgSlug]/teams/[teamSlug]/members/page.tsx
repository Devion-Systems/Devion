'use client'

import { PageHeader } from '@/components/layout/page-header'

export default function TeamsDetailMembersPage({ params }: { params: { orgSlug: string, teamSlug: string } }) {
  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Team-Mitglieder"
        description="MemberList via useTeamMembers(teamId)"
      />
      {/* TODO: MemberList via useTeamMembers(teamId) */}
    </div>
  )
}
