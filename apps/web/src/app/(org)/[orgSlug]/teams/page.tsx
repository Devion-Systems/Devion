'use client'

import { PageHeader } from '@/components/layout/page-header'

export default function TeamsPage({ params }: { params: { orgSlug: string } }) {
  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Teams"
        description="TeamCard-Grid via useTeams(orgId)"
      />
      {/* TODO: TeamCard-Grid via useTeams(orgId) */}
    </div>
  )
}
