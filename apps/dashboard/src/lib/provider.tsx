'use client'

import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { makeQueryClient } from './query-client'

let browserQueryClient: QueryClient | undefined

function getQueryClient() {
  // Auf dem Server: immer neuer Client (kein State-Sharing zwischen Requests)
  if (typeof window === 'undefined') {
    return makeQueryClient()
  }
  // Im Browser: einmal erstellen, wiederverwenden (kein Re-Create bei Re-Render)
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient()
  }
  return browserQueryClient
}

export function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient()

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  )
}