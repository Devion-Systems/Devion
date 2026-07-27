'use client'

export default function ProjectsDetailSettingsLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { orgSlug: string, projectId: string }
}) {
  return (
    <div>
      {/* TODO: Horizontale Tab-Nav: General / Access / Integrations / Danger Zone */}
      {children}
    </div>
  )
}
