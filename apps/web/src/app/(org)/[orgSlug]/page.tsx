'use client'

import { PageHeader } from '@/components/layout/page-header'

export default function RootPage({ params }: { params: { orgSlug: string } }) {
  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Org-Dashboard"
        description="Übersicht: aktive Deployments, Ressourcen-Auslastung, letzte Aktivität"
      />
      {/* TODO: Übersicht: aktive Deployments, Ressourcen-Auslastung, letzte Aktivität */}
    </div>
  )
}
