'use client'

import { PageHeader } from '@/components/layout/page-header'

export default function SettingsSecurityPage({ params }: { params: { orgSlug: string } }) {
  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Sicherheit"
        description="SSO, 2FA-Zwang für die gesamte Org"
      />
      {/* TODO: SSO, 2FA-Zwang für die gesamte Org */}
    </div>
  )
}
