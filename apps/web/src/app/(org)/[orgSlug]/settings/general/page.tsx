'use client'

import { PageHeader } from '@/components/layout/page-header'

export default function SettingsGeneralPage({ params }: { params: { orgSlug: string } }) {
  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Allgemein"
        description="Org-Name, Logo, Slug"
      />
      {/* TODO: Org-Name, Logo, Slug */}
    </div>
  )
}
