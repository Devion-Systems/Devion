import nodemailer, { type Transporter } from "nodemailer";
import { parseEnv } from "@repo/core";
import { isFeatureEnabled } from "@repo/feature";

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

let transporterInstance: Transporter | null = null;

/**
 * Erstellt oder gibt den vorhandenen SMTP-Transporter zurück.
 * Gibt null zurück wenn SMTP nicht konfiguriert ist.
 */
function getTransporter(): Transporter | null {
  if (transporterInstance) return transporterInstance;

  const env = parseEnv();

  if (!env.SMTP_HOST) {
    return null;
  }

  transporterInstance = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth:
      env.SMTP_USER && env.SMTP_PASS
        ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
        : undefined,
  });

  return transporterInstance;
}

/**
 * Sendet eine E-Mail über den konfigurierten SMTP-Server.
 *
 * Gibt false zurück wenn:
 * - das Feature "email-service" deaktiviert ist
 * - kein SMTP_HOST konfiguriert ist
 *
 * @throws Bei einem SMTP-Übertragungsfehler
 */
export async function sendEmail(options: SendEmailOptions): Promise<EmailResult> {
  // 1. Feature-Flag prüfen
  const featureActive = await isFeatureEnabled("email-service");
  if (!featureActive) {
    return {
      success: false,
      error: "Email-Service ist deaktiviert (Feature-Flag: email-service = false)",
    };
  }

  // 2. SMTP-Transporter abrufen
  const transporter = getTransporter();
  if (!transporter) {
    return {
      success: false,
      error: "Kein SMTP-Server konfiguriert. Bitte SMTP_HOST in der Umgebungsvariable setzen.",
    };
  }

  // 3. Absender-Adresse ermitteln
  const env = parseEnv();
  const from = env.SMTP_FROM ?? env.SMTP_USER ?? "noreply@devion.app";

  try {
    const info = await transporter.sendMail({
      from,
      to: Array.isArray(options.to) ? options.to.join(", ") : options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });

    return { success: true, messageId: info.messageId };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: `SMTP-Fehler: ${message}` };
  }
}
