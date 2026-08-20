import { useQuery } from '@tanstack/react-query'

export function useProjects(orgId: string) {
  return useQuery({
    queryKey: ['orgs', orgId, 'projects'],   // orgId IMMER im Key
    queryFn: async () => {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? ''}/organizations/${encodeURIComponent(orgId)}/projects`,
        { credentials: 'include' },
      )
      if (!response.ok) throw new Error('Projekte konnten nicht geladen werden.')
      return response.json()
    },
  })
}
