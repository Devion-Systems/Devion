'use client'

import { PageHeader } from '@/components/layout/page-header'

export default function AdminPage() {
  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Plattform-Übersicht"
        description="System-weite Kennzahlen: Orgs, Nutzer, aktive Deployments"
      />
      {/* TODO: System-weite Kennzahlen: Orgs, Nutzer, aktive Deployments */}
    </div>
  )
}
