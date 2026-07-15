// features/auth/hooks.ts
import { useQuery } from '@tanstack/react-query'
import { authClient } from '@/lib/auth-client'

export function useSession() {
  return useQuery({
    queryKey: ['auth', 'session'],
    queryFn: async () => {
      // better-auth hat keine fertige getSession-Methode im Client,
      // aber du kannst einen API-Call zum Backend machen
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/auth/session`,
        { credentials: 'include' }
      )
      if (!response.ok) return null
      return response.json()
    },
  })
}