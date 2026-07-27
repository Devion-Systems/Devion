'use client'

import { PageHeader } from '@/components/layout/page-header'

export default function DatabasesDetailBackupsPage({ params }: { params: { orgSlug: string, databaseId: string } }) {
  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Backups"
        description="BackupTable, manuelles Backup auslösen, Retention-Policy"
      />
      {/* TODO: BackupTable, manuelles Backup auslösen, Retention-Policy */}
    </div>
  )
}
