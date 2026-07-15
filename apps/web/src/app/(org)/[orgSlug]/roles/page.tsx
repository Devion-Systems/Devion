'use client'

import { PageHeader } from '@/components/layout/page-header'

export default function RolesPage({ params }: { params: { orgSlug: string } }) {
  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Rollen"
        description="Übersicht Owner/Admin/Member/Viewer + Custom Roles"
      />
      {/* TODO: Übersicht Owner/Admin/Member/Viewer + Custom Roles */}
    </div>
  )
}
