'use client'

import { PageHeader } from '@/components/layout/page-header'

export default function DatabasesDetailSettingsDangerZonePage({ params }: { params: { orgSlug: string, databaseId: string } }) {
  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Danger Zone"
        description="Löschen, Downsize"
      />
      {/* TODO: Löschen, Downsize */}
    </div>
  )
}
