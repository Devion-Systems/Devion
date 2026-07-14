import { Sidebar } from '@/components/layout/sidebar'
// ... OrgProvider wie vorher

export default async function OrgLayout({ children, params }: Props) {
  // ... org + membership laden

  return (
    <OrgProvider org={org} membership={membership}>
      <div className="flex min-h-screen">
        <Sidebar variant="org" />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </OrgProvider>
  )
}