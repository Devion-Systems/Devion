import { createAuthClient } from "better-auth/client";
import { passkeyClient } from "@better-auth/passkey/client";
import { apiKeyClient } from "@better-auth/api-key/client";
import {
  deviceAuthorizationClient,
  emailOTPClient,
  multiSessionClient,
  organizationClient,
  twoFactorClient,
} from "better-auth/client/plugins";

const baseURL = process.env.NEXT_PUBLIC_API_URL;

export const authClient = createAuthClient({
  ...(baseURL ? { baseURL } : {}),
  plugins: [
    passkeyClient(),
    apiKeyClient(),
    deviceAuthorizationClient(),
    emailOTPClient(),
    multiSessionClient(),
    organizationClient({ teams: { enabled: true } }),
    twoFactorClient({ twoFactorPage: "/two-factor" }),
  ],
});
