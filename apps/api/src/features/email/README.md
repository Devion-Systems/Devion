# Email Module (`@repo/email`)

This is a shared, standalone module for sending emails across the Devion ecosystem. It decouples SMTP sending from the `@repo/auth` module, allowing other features (such as contact forms, alerts, and system notifications) to send emails independently.

## Installation

Add the dependency to your package's `package.json`:

```json
"dependencies": {
  "@repo/email": "workspace:*"
}
```

## Configuration

The email service leverages the common configuration from `@repo/core`.

It relies on the following environment variables:
- `SMTP_HOST`: The SMTP server host address (required for sending).
- `SMTP_PORT`: SMTP port (e.g. `587` or `465`).
- `SMTP_SECURE`: Boolean (`true` for TLS port `465`, otherwise `false`).
- `SMTP_USER`: Authentication username.
- `SMTP_PASS`: Authentication password.
- `SMTP_FROM`: Custom sender email address (defaults to `SMTP_USER` or `noreply@devion.app`).

Email delivery is enabled by default:
- With `SMTP_HOST` configured, emails are sent by default.

## Usage

```typescript
import { sendEmail } from "@repo/email";

const result = await sendEmail({
  to: "user@example.com",
  subject: "Welcome to Devion!",
  text: "Thank you for signing up.",
  html: "<h1>Thank you for signing up.</h1>"
});

if (result.success) {
  console.log(`Email sent successfully: ${result.messageId}`);
} else {
  console.error(`Failed to send email: ${result.error}`);
}
```
