'use client'

export default function ProjectsDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { orgSlug: string, projectId: string }
}) {
  return (
    <div>
      {/* TODO: Tab-Nav: Overview / Deployments / Environments / Logs / Metrics / Domains / Settings */}
      {children}
    </div>
  )
}
