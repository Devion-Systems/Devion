'use client'

import { PageHeader } from '@/components/layout/page-header'

export default function CreateOrganizationPage() {
  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Organisation erstellen"
        description="CreateOrgForm, danach Redirect zu /{orgSlug}"
      />
      {/* TODO: CreateOrgForm, danach Redirect zu /{orgSlug} */}
    </div>
  )
}
