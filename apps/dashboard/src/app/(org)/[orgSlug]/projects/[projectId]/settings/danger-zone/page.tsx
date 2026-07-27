'use client'

import { PageHeader } from '@/components/layout/page-header'

export default function ProjectsDetailSettingsDangerZonePage({ params }: { params: { orgSlug: string, projectId: string } }) {
  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Danger Zone"
        description="Projekt löschen (Bestätigung via Namens-Eingabe), Transfer zu anderem Team"
      />
      {/* TODO: Projekt löschen (Bestätigung via Namens-Eingabe), Transfer zu anderem Team */}
    </div>
  )
}
