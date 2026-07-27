'use client'

import { PageHeader } from '@/components/layout/page-header'

export default function ResourcesSharedPage({ params }: { params: { orgSlug: string } }) {
  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Shared Resources"
        description="SharedResourceTable via useSharedResources(orgId)"
      />
      {/* TODO: SharedResourceTable via useSharedResources(orgId) */}
    </div>
  )
}
