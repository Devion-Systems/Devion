'use client'

import { PageHeader } from '@/components/layout/page-header'

export default function ProjectsDetailSettingsAccessPage({ params }: { params: { orgSlug: string, projectId: string } }) {
  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Zugriff"
        description="Wer darf sehen/deployen — nutzt can() aus features/permissions"
      />
      {/* TODO: Wer darf sehen/deployen — nutzt can() aus features/permissions */}
    </div>
  )
}
