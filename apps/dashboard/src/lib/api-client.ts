// lib/api-client.ts
import { hc } from 'hono/client'


const baseUrl = process.env.NEXT_PUBLIC_API_URL;

if (!baseUrl) {
  throw new Error('API URL ist nicht gesetzt')
}

export const client = hc(baseUrl, {
    init: {
      credentials: 'include',
    },
})
