'use client'

import { PageHeader } from '@/components/layout/page-header'

export default function DatabasesNewPage({ params }: { params: { orgSlug: string } }) {
  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Neue Datenbank"
        description="ProvisionDatabaseWizard — Engine → Version → Größe → Node"
      />
      {/* TODO: ProvisionDatabaseWizard — Engine → Version → Größe → Node */}
    </div>
  )
}
