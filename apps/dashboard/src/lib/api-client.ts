// lib/api-client.ts
import { hc } from 'hono/client'


// An empty base URL deliberately uses the current browser origin. Traefik
// routes API paths to the API service, so installations work from an IP or a
// later-added custom domain without compiling an address into the dashboard.
const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "";

export const client = hc(baseUrl, {
    init: {
      credentials: 'include',
    },
})
