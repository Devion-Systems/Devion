'use client'

import { PageHeader } from '@/components/layout/page-header'

export default function ResourcesSharedNewPage({ params }: { params: { orgSlug: string } }) {
  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Ressource freigeben"
        description="ShareResourceDialog-Inhalt als eigene Seite"
      />
      {/* TODO: ShareResourceDialog-Inhalt als eigene Seite */}
    </div>
  )
}
