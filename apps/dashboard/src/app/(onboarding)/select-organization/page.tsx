'use client'

import { PageHeader } from '@/components/layout/page-header'

export default function SelectOrganizationPage() {
  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Organisation wählen"
        description="Liste via useUserOrganizations, Klick navigiert zu /{orgSlug}"
      />
      {/* TODO: Liste via useUserOrganizations, Klick navigiert zu /{orgSlug} */}
    </div>
  )
}
