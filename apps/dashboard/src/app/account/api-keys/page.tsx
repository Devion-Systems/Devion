'use client'

import { PageHeader } from '@/components/layout/page-header'

export default function AccountApiKeysPage() {
  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="API-Keys"
        description="ApiKeyList via useApiKeys, Reveal-Pattern wie Connection-Strings"
      />
      {/* TODO: ApiKeyList via useApiKeys, Reveal-Pattern wie Connection-Strings */}
    </div>
  )
}
