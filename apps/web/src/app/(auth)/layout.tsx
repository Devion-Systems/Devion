'use client'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div>
      {/* TODO: Zentrierter Wrapper ohne Sidebar, für alle Login/Register-Flows */}
      {children}
    </div>
  )
}
