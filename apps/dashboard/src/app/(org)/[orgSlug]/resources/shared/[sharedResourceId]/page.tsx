'use client'

import { PageHeader } from '@/components/layout/page-header'

export default function ResourcesSharedDetailPage({ params }: { params: { orgSlug: string, sharedResourceId: string } }) {
  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Freigabe-Detail"
        description="AccessGrantList — wer hat aktuell Zugriff"
      />
      {/* TODO: AccessGrantList — wer hat aktuell Zugriff */}
    </div>
  )
}
