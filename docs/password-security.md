# Password security

Devion rejects passwords that appear in the Have I Been Pwned Pwned Passwords database during account creation and password changes, including the e-mail-code recovery flow.

The check is enabled by default with `HIBP_ENABLED=true`. It uses the Pwned Passwords k-anonymity range API: only the first five characters of a SHA-1 password hash leave the Devion API; the plaintext password and complete hash are never transmitted.

Keep the setting enabled in production. `HIBP_ENABLED=false` is available solely for controlled offline development or emergency operations, and should be re-enabled immediately afterward.
