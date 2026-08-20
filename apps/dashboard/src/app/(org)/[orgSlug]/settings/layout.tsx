'use client'

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div>
      {/* TODO: Horizontale Tab-Nav: General / Security / Integrations / Danger Zone */}
      {children}
    </div>
  )
}
