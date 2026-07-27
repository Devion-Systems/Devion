'use client'

import { PageHeader } from '@/components/layout/page-header'

export default function SettingsDangerZonePage({ params }: { params: { orgSlug: string } }) {
  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Danger Zone"
        description="Org löschen, Ownership übertragen"
      />
      {/* TODO: Org löschen, Ownership übertragen */}
    </div>
  )
}
