'use client'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div>
      {/* TODO: Eigener Sidebar-Scope (variant='admin'), Zugriff nur für Plattform-Admins — siehe middleware.ts */}
      {children}
    </div>
  )
}
