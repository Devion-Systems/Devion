'use client'

import { PageHeader } from '@/components/layout/page-header'

export default function AdminUsersDetailImpersonatePage({ params }: { params: { userId: string } }) {
  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Als Nutzer anmelden"
        description="ImpersonateButton-Flow — erzeugt eigenen Audit-Log-Eintrag"
      />
      {/* TODO: ImpersonateButton-Flow — erzeugt eigenen Audit-Log-Eintrag */}
    </div>
  )
}
