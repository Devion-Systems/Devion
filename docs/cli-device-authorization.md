# CLI device authorization

Devion CLI clients authenticate through the OAuth 2.0 Device Authorization flow. A CLI never stores a password or a shared client secret. It requests a short-lived device code, the user explicitly approves that code in the dashboard, and the CLI receives a signed bearer token for the existing API.

The registered public client identifier is `devion-cli`. Device codes expire after ten minutes and clients must poll no faster than every five seconds.

## CLI flow

1. Request a code from `POST /api/auth/device/code` with `{ "client_id": "devion-cli", "scope": "api" }`.
2. Display `verification_uri` and `user_code`; open `verification_uri_complete` when available.
3. Poll `POST /api/auth/device/token` every `interval` seconds using the returned `device_code` and `client_id`.
4. Store the returned `access_token` in the operating system credential store and send it with API requests.

```http
Authorization: Bearer <access_token>
```

For example, the CLI can call the existing control-plane routes directly:

```bash
curl -H "Authorization: Bearer $DEVION_ACCESS_TOKEN" \
  "https://devion.example.com/organizations/acme/projects"
```

Treat the token as a password: do not print it, commit it, or store it in plaintext. The bearer token is a signed Devion session token; its expiry and revocation follow the normal Better Auth session rules.
