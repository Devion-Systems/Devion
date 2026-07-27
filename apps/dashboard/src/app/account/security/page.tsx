'use client'

import { PageHeader } from '@/components/layout/page-header'

export default function AccountSecurityPage() {
  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Sicherheit"
        description="ChangePasswordForm, 2FA-Setup via authClient"
      />
      {/* TODO: ChangePasswordForm, 2FA-Setup via authClient */}
    </div>
  )
}
