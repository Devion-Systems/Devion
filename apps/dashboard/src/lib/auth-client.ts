import { createAuthClient } from "better-auth/client";
import {
  organizationClient,
  twoFactorClient,
} from "better-auth/client/plugins";

const baseURL = process.env.NEXT_PUBLIC_API_URL;

export const authClient = createAuthClient({
  ...(baseURL ? { baseURL } : {}),
  plugins: [
    organizationClient({ teams: { enabled: true } }),
    twoFactorClient(),
  ],
});
