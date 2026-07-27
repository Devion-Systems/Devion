'use client'

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div>
      {/* TODO: Persönliche Settings, unabhängig von der aktiven Org */}
      {children}
    </div>
  )
}
