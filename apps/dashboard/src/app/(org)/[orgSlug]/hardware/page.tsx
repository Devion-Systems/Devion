'use client'

import { PageHeader } from '@/components/layout/page-header'

export default function HardwarePage({ params }: { params: { orgSlug: string } }) {
  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Hardware"
        description="NodeTable (siehe Docs-Site TanStack-Table-Beispiel) via useNodes(orgId)"
      />
      {/* TODO: NodeTable (siehe Docs-Site TanStack-Table-Beispiel) via useNodes(orgId) */}
    </div>
  )
}
