"use client";

import {
  CheckCircle2,
  Copy,
  Fingerprint,
  KeyRound,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { type FormEvent, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { useSession } from "@/features/auth/hooks/hooks";
import { authClient } from "@/lib/auth-client";

export default function AccountSecurityPage() {
  const { data: session, refetch } = useSession();
  const [setupPassword, setSetupPassword] = useState("");
  const [disablePassword, setDisablePassword] = useState("");
  const [totpUri, setTotpUri] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAddingPasskey, setIsAddingPasskey] = useState(false);
  const [passkeyMessage, setPasskeyMessage] = useState<string | null>(null);
  const [passkeys, setPasskeys] = useState<
    Array<{ id: string; name?: string | null; createdAt?: Date | string }>
  >([]);
  const enabled = Boolean(session?.user.twoFactorEnabled);
  async function loadPasskeys() {
    const { data } = await authClient.passkey.listUserPasskeys();
    setPasskeys(data ?? []);
  }
  useEffect(() => {
    void loadPasskeys();
  }, []);

  async function startSetup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setIsSubmitting(true);
    try {
      const { data, error } = await authClient.twoFactor.enable({
        password: setupPassword,
        issuer: "Devion",
        method: "totp",
      });
      if (error || !data || data.method !== "totp") {
        setMessage(
          error?.message ??
            "Die Zwei-Faktor-Authentifizierung konnte nicht vorbereitet werden.",
        );
        return;
      }
      setTotpUri(data.totpURI);
      setBackupCodes(data.backupCodes);
      setSetupPassword("");
      setMessage(
        "Scanne den QR-Code und bestätige anschließend den aktuellen Code deiner Authenticator-App.",
      );
    } catch {
      setMessage("Der Authentifizierungsdienst ist gerade nicht erreichbar.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function confirmSetup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setMessage(
        "Bitte gib den sechsstelligen Code aus deiner Authenticator-App ein.",
      );
      return;
    }
    setIsSubmitting(true);
    setMessage(null);
    try {
      const { error } = await authClient.twoFactor.verifyTotp({ code });
      if (error) {
        setMessage(
          error.message ??
            "Der Code ist ungültig. Bitte versuche es mit dem nächsten Code erneut.",
        );
        return;
      }
      setCode("");
      setTotpUri(null);
      await refetch();
      setMessage("Die Zwei-Faktor-Authentifizierung ist jetzt aktiv.");
    } catch {
      setMessage("Der Authentifizierungsdienst ist gerade nicht erreichbar.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function disableTwoFactor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);
    try {
      const { error } = await authClient.twoFactor.disable({
        password: disablePassword,
      });
      if (error) {
        setMessage(
          error.message ??
            "Die Zwei-Faktor-Authentifizierung konnte nicht deaktiviert werden.",
        );
        return;
      }
      setDisablePassword("");
      setBackupCodes([]);
      await refetch();
      setMessage("Die Zwei-Faktor-Authentifizierung wurde deaktiviert.");
    } catch {
      setMessage("Der Authentifizierungsdienst ist gerade nicht erreichbar.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function copyBackupCodes() {
    await navigator.clipboard.writeText(backupCodes.join("\n"));
    setMessage(
      "Backup-Codes wurden in die Zwischenablage kopiert. Bewahre sie sicher auf.",
    );
  }

  async function addPasskey() {
    setPasskeyMessage(null);
    setIsAddingPasskey(true);
    try {
      const { error } = await authClient.passkey.addPasskey({
        name: "Devion Passkey",
        authenticatorAttachment: "platform",
      });
      setPasskeyMessage(
        error
          ? (error.message ?? "Der Passkey konnte nicht hinzugefügt werden.")
          : "Passkey hinzugefügt. Du kannst dich künftig mit diesem Gerät anmelden.",
      );
      await loadPasskeys();
    } catch {
      setPasskeyMessage(
        "Passkeys werden von diesem Browser oder Gerät nicht unterstützt.",
      );
    } finally {
      setIsAddingPasskey(false);
    }
  }
  async function removePasskey(id: string) {
    const { error } = await authClient.passkey.deletePasskey({ id });
    setPasskeyMessage(error?.message ?? "Passkey wurde entfernt.");
    await loadPasskeys();
  }

  return (
    <div className="space-y-6 py-1">
      <PageHeader
        title="Sicherheit"
        description="Schütze dein Konto mit einer Authenticator-App."
      />
      <section className="max-w-2xl rounded-2xl border border-white/[0.07] bg-[#172128]/90 p-6">
        <div className="mb-6 flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-[#0984e3]/15 text-[#74b9ff]">
            <ShieldCheck className="size-5" />
          </span>
          <div>
            <h2 className="font-semibold text-zinc-100">Authenticator-App</h2>
            <p className="text-sm text-zinc-500">
              {enabled
                ? "Zwei-Faktor-Authentifizierung ist aktiv."
                : "Noch nicht aktiviert."}
            </p>
          </div>
        </div>

        {!enabled && !totpUri ? (
          <form className="space-y-4" onSubmit={startSetup}>
            <p className="text-sm text-zinc-400">
              Verwende beispielsweise Google Authenticator, 1Password, Authy
              oder Microsoft Authenticator.
            </p>
            <label
              className="block space-y-1.5 text-sm font-medium text-zinc-300"
              htmlFor="two-factor-password"
            >
              Aktuelles Passwort
              <input
                id="two-factor-password"
                type="password"
                autoComplete="current-password"
                className="h-10 w-full rounded-xl border border-white/[0.08] bg-[#0b1217] px-3 text-sm outline-none focus:border-[#0984e3]/60"
                value={setupPassword}
                onChange={(event) => setSetupPassword(event.target.value)}
                disabled={isSubmitting}
                required
              />
            </label>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? "Wird vorbereitet …"
                : "Authenticator-App einrichten"}
              <KeyRound />
            </Button>
          </form>
        ) : null}

        {!enabled && totpUri ? (
          <div className="space-y-5">
            <div className="flex flex-col items-center gap-4 rounded-2xl bg-white p-5 text-center sm:flex-row sm:text-left">
              <QRCodeSVG value={totpUri} size={176} level="M" includeMargin />
              <p className="text-sm text-zinc-700">
                Scanne den QR-Code in deiner Authenticator-App. Danach gib den
                aktuellen sechsstelligen Code ein, um die Einrichtung
                abzuschließen.
              </p>
            </div>
            <form className="space-y-4" onSubmit={confirmSetup}>
              <label
                className="block space-y-1.5 text-sm font-medium text-zinc-300"
                htmlFor="authenticator-code"
              >
                Code aus der Authenticator-App
                <input
                  id="authenticator-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  className="h-10 w-full rounded-xl border border-white/[0.08] bg-[#0b1217] px-3 text-sm outline-none focus:border-[#0984e3]/60"
                  value={code}
                  onChange={(event) =>
                    setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  disabled={isSubmitting}
                  required
                />
              </label>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting
                  ? "Code wird geprüft …"
                  : "Einrichtung bestätigen"}
                <CheckCircle2 />
              </Button>
            </form>
          </div>
        ) : null}

        {enabled ? (
          <form className="space-y-4" onSubmit={disableTwoFactor}>
            <p className="text-sm text-zinc-400">
              Zum Deaktivieren ist dein aktuelles Passwort erforderlich.
            </p>
            <label
              className="block space-y-1.5 text-sm font-medium text-zinc-300"
              htmlFor="disable-two-factor-password"
            >
              Aktuelles Passwort
              <input
                id="disable-two-factor-password"
                type="password"
                autoComplete="current-password"
                className="h-10 w-full rounded-xl border border-white/[0.08] bg-[#0b1217] px-3 text-sm outline-none focus:border-[#0984e3]/60"
                value={disablePassword}
                onChange={(event) => setDisablePassword(event.target.value)}
                disabled={isSubmitting}
                required
              />
            </label>
            <Button type="submit" variant="destructive" disabled={isSubmitting}>
              {isSubmitting ? "Deaktiviere …" : "2FA deaktivieren"}
              <LockKeyhole />
            </Button>
          </form>
        ) : null}

        {message ? (
          <p className="mt-5 flex items-center gap-2 text-sm text-[#81ecec]">
            <CheckCircle2 className="size-4" />
            {message}
          </p>
        ) : null}
      </section>

      <section className="max-w-2xl rounded-2xl border border-white/[0.07] bg-[#172128]/90 p-6">
        <div className="mb-6 flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-[#0984e3]/15 text-[#74b9ff]">
            <Fingerprint className="size-5" />
          </span>
          <div>
            <h2 className="font-semibold text-zinc-100">Passkey</h2>
            <p className="text-sm text-zinc-500">
              Melde dich mit Face ID, Touch ID, Windows Hello oder einem
              Sicherheitsschlüssel an.
            </p>
          </div>
        </div>
        <p className="text-sm text-zinc-400">
          Der Passkey ist an dieses Gerät oder deinen Passwortmanager gebunden.
          Zur Registrierung ist eine lokale Gerätebestätigung erforderlich.
        </p>
        <Button
          type="button"
          className="mt-5"
          disabled={isAddingPasskey}
          onClick={() => void addPasskey()}
        >
          <Fingerprint />{" "}
          {isAddingPasskey
            ? "Passkey wird hinzugefügt …"
            : "Passkey hinzufügen"}
        </Button>
        {passkeyMessage ? (
          <p className="mt-4 flex items-center gap-2 text-sm text-[#81ecec]">
            <CheckCircle2 className="size-4" />
            {passkeyMessage}
          </p>
        ) : null}
        {passkeys.length > 0 ? (
          <div className="mt-5 space-y-2">
            {passkeys.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-xl border border-white/[0.08] p-3 text-sm"
              >
                <span>{item.name || "Passkey"}</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void removePasskey(item.id)}
                >
                  Entfernen
                </Button>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      {backupCodes.length > 0 ? (
        <section className="max-w-2xl rounded-2xl border border-amber-300/20 bg-amber-300/[0.06] p-6">
          <h2 className="font-semibold text-amber-100">Backup-Codes</h2>
          <p className="mt-1 text-sm text-amber-100/70">
            Speichere diese Codes jetzt an einem sicheren Ort. Jeder Code kann
            nur einmal verwendet werden und wird nach dem Verlassen dieser Seite
            nicht erneut angezeigt.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-black/20 p-3 font-mono text-sm text-amber-50 sm:grid-cols-5">
            {backupCodes.map((backupCode) => (
              <span key={backupCode}>{backupCode}</span>
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            className="mt-4"
            onClick={() => void copyBackupCodes()}
          >
            <Copy /> Codes kopieren
          </Button>
        </section>
      ) : null}
    </div>
  );
}
