'use client'

export default function SettingsLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { orgSlug: string }
}) {
  return (
    <div>
      {/* TODO: Horizontale Tab-Nav: General / Security / Integrations / Danger Zone */}
      {children}
    </div>
  )
}
