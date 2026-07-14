// lib/api-client.ts
import { hc } from 'hono/client'
import type { AppType } from '@devion/types'
import { clientEnv } from "@devion/env"
const baseUrl = clientEnv.NEXT_PUBLIC_API_URL;

if (!baseUrl) {
  throw new Error('API URL ist nicht gesetzt')
}

export const client = hc<AppType>(baseUrl, {
    init: {
      credentials: 'include',
    },
})