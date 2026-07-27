'use client'

import { PageHeader } from '@/components/layout/page-header'

export default function AccountNotificationsPage() {
  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Benachrichtigungen"
        description="E-Mail/Push-Präferenzen"
      />
      {/* TODO: E-Mail/Push-Präferenzen */}
    </div>
  )
}
