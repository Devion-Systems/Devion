'use client'

import { PageHeader } from '@/components/layout/page-header'

export default function DatabasesDetailAccessCredentialsNewPage({ params }: { params: { orgSlug: string, databaseId: string } }) {
  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Neuer Zugang"
        description="Neuen DB-User/Read-Replica-Zugang anlegen"
      />
      {/* TODO: Neuen DB-User/Read-Replica-Zugang anlegen */}
    </div>
  )
}
