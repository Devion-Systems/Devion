'use client'

import { PageHeader } from '@/components/layout/page-header'

export default function DatabasesPage({ params }: { params: { orgSlug: string } }) {
  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Datenbanken"
        description="DatabaseTable via useDatabases(orgId)"
      />
      {/* TODO: DatabaseTable via useDatabases(orgId) */}
    </div>
  )
}
