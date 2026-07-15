'use client'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div>
      {/* TODO: Zentrierter Wrapper, kein Sidebar */}
      {children}
    </div>
  )
}
