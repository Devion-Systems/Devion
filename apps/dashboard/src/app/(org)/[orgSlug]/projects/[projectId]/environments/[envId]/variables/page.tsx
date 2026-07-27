'use client'

import { PageHeader } from '@/components/layout/page-header'

export default function ProjectsDetailEnvironmentsDetailVariablesPage({ params }: { params: { orgSlug: string, projectId: string, envId: string } }) {
  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Umgebungsvariablen"
        description="EnvVarEditor, verschlüsselte Secrets maskiert anzeigen"
      />
      {/* TODO: EnvVarEditor, verschlüsselte Secrets maskiert anzeigen */}
    </div>
  )
}
