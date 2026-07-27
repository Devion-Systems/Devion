'use client'

import { PageHeader } from '@/components/layout/page-header'

export default function AccountSessionsPage() {
  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Aktive Sitzungen"
        description="Geräte-Liste, einzelne Session widerrufen"
      />
      {/* TODO: Geräte-Liste, einzelne Session widerrufen */}
    </div>
  )
}
