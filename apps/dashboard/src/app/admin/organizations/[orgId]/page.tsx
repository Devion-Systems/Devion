'use client'

import { PageHeader } from '@/components/layout/page-header'

export default function AdminOrganizationsDetailPage({ params }: { params: { orgId: string } }) {
  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Org-Detail (Admin)"
        description="Support-Sicht auf eine einzelne Organisation"
      />
      {/* TODO: Support-Sicht auf eine einzelne Organisation */}
    </div>
  )
}
