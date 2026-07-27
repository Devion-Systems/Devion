'use client'

import { PageHeader } from '@/components/layout/page-header'

export default function ProjectsNewPage({ params }: { params: { orgSlug: string } }) {
  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Neues Projekt"
        description="CreateProjectForm, Git-Repo-Connect optional"
      />
      {/* TODO: CreateProjectForm, Git-Repo-Connect optional */}
    </div>
  )
}
