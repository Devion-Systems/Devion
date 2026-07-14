// lib/query-client.ts
import { QueryClient } from '@tanstack/react-query'

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000,        // 30s bevor als "stale" markiert
        gcTime: 5 * 60 * 1000,        // 5min Cache-Lebensdauer nach letztem Unmount
        retry: 1,                      // nicht endlos retryen bei Fehlern
        refetchOnWindowFocus: true,    // sinnvoll bei Live-Status-Daten (Server/Deployments)
      },
    },
  })
}