'use client'

import { PageHeader } from '@/components/layout/page-header'

export default function AdminOrganizationsDetailMembersPage({ params }: { params: { orgId: string } }) {
  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Org-Mitglieder (Admin)"
        description="Mitgliederliste dieser Org aus Admin-Sicht"
      />
      {/* TODO: Mitgliederliste dieser Org aus Admin-Sicht */}
    </div>
  )
}
