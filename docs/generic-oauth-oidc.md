# Generic OAuth / OIDC SSO

Devion uses Better Auth's `genericOAuth` plugin for a standards-based OAuth 2.1 and OpenID Connect login. It supports any discovery-capable OIDC provider, including Keycloak, Okta, Auth0 and Microsoft Entra ID.

Configure the identity provider with this callback URL, replacing `oidc` only when `OIDC_PROVIDER_ID` was changed:

```text
${BETTER_AUTH_URL}/api/auth/callback/oidc
```

Set these values in `deploy/docker/.env` and rebuild the dashboard:

```dotenv
OIDC_ISSUER=https://id.example.com/realms/company
OIDC_CLIENT_ID=devion
OIDC_CLIENT_SECRET=replace-with-the-provider-secret
OIDC_PROVIDER_ID=oidc
OIDC_PROVIDER_NAME=Company SSO
OIDC_ALLOWED_EMAIL_DOMAINS=example.com
OIDC_ALLOW_SIGN_UP=false
NEXT_PUBLIC_OIDC_ENABLED=true
```

All three core OIDC values must be configured together. Discovery, PKCE, ID-token signature/issuer/audience validation and OIDC nonce binding are active. New SSO accounts remain disabled by default; explicitly set `OIDC_ALLOW_SIGN_UP=true` only when the identity provider is allowed to provision Devion users automatically. The optional domain allowlist is checked against the verified provider identity on every sign-in.
