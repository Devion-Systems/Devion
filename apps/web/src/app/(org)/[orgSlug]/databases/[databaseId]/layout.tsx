'use client'

export default function DatabasesDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { orgSlug: string, databaseId: string }
}) {
  return (
    <div>
      {/* TODO: Tab-Nav: Overview / Metrics / Backups / Access / Logs / Settings */}
      {children}
    </div>
  )
}
