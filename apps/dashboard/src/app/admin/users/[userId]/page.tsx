'use client'

import { PageHeader } from '@/components/layout/page-header'

export default function AdminUsersDetailPage({ params }: { params: { userId: string } }) {
  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Nutzer-Detail (Admin)"
        description="Account-Status, Orgs dieses Nutzers"
      />
      {/* TODO: Account-Status, Orgs dieses Nutzers */}
    </div>
  )
}
