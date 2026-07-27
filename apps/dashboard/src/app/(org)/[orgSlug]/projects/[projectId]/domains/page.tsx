'use client'

import { PageHeader } from '@/components/layout/page-header'

export default function ProjectsDetailDomainsPage({ params }: { params: { orgSlug: string, projectId: string } }) {
  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Domains"
        description="Custom-Domain-Liste, SSL-Status je Domain"
      />
      {/* TODO: Custom-Domain-Liste, SSL-Status je Domain */}
    </div>
  )
}
