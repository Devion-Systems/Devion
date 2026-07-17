'use client'

export default function TeamsDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { orgSlug: string, teamSlug: string }
}) {
  return (
    <div>
      {/* TODO: Tab-Nav: Overview / Members / Projects / Settings */}
      {children}
    </div>
  )
}
