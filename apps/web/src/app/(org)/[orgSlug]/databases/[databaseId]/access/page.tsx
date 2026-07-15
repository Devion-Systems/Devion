'use client'

import { PageHeader } from '@/components/layout/page-header'

export default function DatabasesDetailAccessPage({ params }: { params: { orgSlug: string, databaseId: string } }) {
  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Zugriff"
        description="Verbundene Projekte, CredentialsList"
      />
      {/* TODO: Verbundene Projekte, CredentialsList */}
    </div>
  )
}
