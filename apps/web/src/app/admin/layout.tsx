import { Sidebar } from '@/components/layout/sidebar'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar variant="admin" />
      <main className="flex-1 overflow-y-auto p-6">{children}</main>
    </div>
  )
}