'use client'

import { PageHeader } from '@/components/layout/page-header'

export default function DatabasesDetailPage({ params }: { params: { orgSlug: string, databaseId: string } }) {
  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Datenbank-Übersicht"
        description="Status, Engine+Version, ConnectionStringCard (Reveal-Pattern, s. Doku)"
      />
      {/* TODO: Status, Engine+Version, ConnectionStringCard (Reveal-Pattern, s. Doku) */}
    </div>
  )
}
