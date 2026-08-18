'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { OrgProvider } from '@/features/organizations/context/org-context'
import { Sidebar } from '@/components/layout/sidebar'
import type { Organization, Membership } from '@/features/organizations/types'

type OrgWithMembership = {
  org: Organization
  membership: Membership
}

function useOrgBySlug(slug: string) {
  return useQuery<OrgWithMembership>({
    queryKey: ['orgs', slug],
    queryFn: async () => {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? ''
      const res = await fetch(`${baseUrl}/organizations/${slug}`, {
        credentials: 'include',
      })
      if (!res.ok) throw new Error('Organisation nicht gefunden')
      return res.json()
    },
    enabled: !!slug,
  })
}

export default function OrgLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { orgSlug } = useParams<{ orgSlug: string }>()
  const router = useRouter()
  const { data, isLoading, isError } = useOrgBySlug(orgSlug)

  useEffect(() => {
    if (isError) router.replace('/select-organization')
  }, [isError, router])

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#11191f]">
        <div className="flex items-center gap-3 text-sm text-zinc-500">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-700 border-t-[#0984e3]" />
          Lade Organisation …
        </div>
      </div>
    )
  }

  if (!data) return null

  return (
    <OrgProvider org={data.org} membership={data.membership}>
      <div className="flex h-screen overflow-hidden bg-[#11191f]">
        <Sidebar variant="org" />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </OrgProvider>
  )
}
