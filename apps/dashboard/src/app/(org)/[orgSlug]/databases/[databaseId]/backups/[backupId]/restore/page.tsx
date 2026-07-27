'use client'

import { PageHeader } from '@/components/layout/page-header'

export default function DatabasesDetailBackupsDetailRestorePage({ params }: { params: { orgSlug: string, databaseId: string, backupId: string } }) {
  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Restore"
        description="RestoreConfirmDialog — zweistufige Bestätigung, destruktiv"
      />
      {/* TODO: RestoreConfirmDialog — zweistufige Bestätigung, destruktiv */}
    </div>
  )
}
