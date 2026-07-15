'use client'

import { PageHeader } from '@/components/layout/page-header'

export default function RolesDetailPage({ params }: { params: { orgSlug: string, roleId: string } }) {
  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Rolle bearbeiten"
        description="Permission-Editor basierend auf features/permissions/constants.ts"
      />
      {/* TODO: Permission-Editor basierend auf features/permissions/constants.ts */}
    </div>
  )
}
