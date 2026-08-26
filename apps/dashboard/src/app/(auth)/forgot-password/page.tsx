"use client";

import {
  ArrowLeft,
  ArrowRight,
  AtSign,
  KeyRound,
  LockKeyhole,
} from "lucide-react";
import Link from "next/link";
import { type FormEvent, useState } from "react";

import { authClient } from "@/lib/auth-client";

import {
  AuthButton,
  AuthField,
  AuthHeader,
  AuthPanel,
} from "../_components/AuthPrimitives";

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<"email" | "code" | "password">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function requestCode() {
    setError(null);
    setNotice(null);
    setIsSubmitting(true);

    try {
      const { error: requestError } =
        await authClient.emailOtp.requestPasswordReset({
          email: email.trim(),
        });
      if (requestError) {
        setError(
          "Der Code konnte gerade nicht angefordert werden. Bitte versuche es später erneut.",
        );
        return;
      }
      setStep("code");
      setNotice(
        "Falls ein Konto zu dieser E-Mail-Adresse existiert, wurde ein Sicherheitscode versendet.",
      );
    } catch {
      setError(
        "Der Authentifizierungsdienst ist gerade nicht erreichbar. Bitte versuche es später erneut.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);

    if (!/^\d{8}$/.test(otp)) {
      setError("Bitte gib den vollständigen achtstelligen Code ein.");
      return;
    }

    setIsSubmitting(true);
    try {
      const { error: verificationError } =
        await authClient.emailOtp.checkVerificationOtp({
          email: email.trim(),
          type: "forget-password",
          otp,
        });
      if (verificationError) {
        setError(
          "Der Code ist ungültig, abgelaufen oder wurde zu oft falsch eingegeben.",
        );
        return;
      }
      setStep("password");
    } catch {
      setError(
        "Der Authentifizierungsdienst ist gerade nicht erreichbar. Bitte versuche es später erneut.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function resetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password") ?? "");
    const passwordConfirmation = String(
      formData.get("passwordConfirmation") ?? "",
    );

    if (password.length < 12) {
      setError("Das Passwort muss mindestens 12 Zeichen lang sein.");
      return;
    }
    if (password !== passwordConfirmation) {
      setError("Die Passwörter stimmen nicht überein.");
      return;
    }

    setIsSubmitting(true);
    try {
      const { error: resetError } = await authClient.emailOtp.resetPassword({
        email: email.trim(),
        otp,
        password,
      });
      if (resetError) {
        setError(
          resetError.message ??
            "Das Passwort konnte nicht geändert werden. Fordere bei Bedarf einen neuen Code an.",
        );
        return;
      }
      setNotice("Dein Passwort wurde geändert. Du kannst dich jetzt anmelden.");
      setStep("email");
      setOtp("");
    } catch {
      setError(
        "Der Authentifizierungsdienst ist gerade nicht erreichbar. Bitte versuche es später erneut.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthPanel>
      <AuthHeader
        eyebrow="Account recovery"
        title={
          step === "email"
            ? "Passwort zurücksetzen."
            : step === "code"
              ? "Code bestätigen."
              : "Neues Passwort wählen."
        }
        description={
          step === "email"
            ? "Gib deine E-Mail-Adresse ein. Wir senden dir einen achtstelligen Sicherheitscode."
            : step === "code"
              ? "Gib den achtstelligen Code aus der E-Mail ein."
              : "Lege jetzt ein neues, sicheres Passwort fest."
        }
      />

      {step === "email" ? (
        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            void requestCode();
          }}
        >
          <AuthField
            id="email"
            name="email"
            type="email"
            label="E-Mail-Adresse"
            icon={AtSign}
            placeholder="du@beispiel.de"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <AuthButton disabled={isSubmitting}>
            {isSubmitting
              ? "Code wird angefordert ..."
              : "Sicherheitscode anfordern"}{" "}
            <ArrowRight className="size-4" />
          </AuthButton>
        </form>
      ) : null}

      {step === "code" ? (
        <form className="space-y-5" onSubmit={verifyCode}>
          <AuthField
            id="code"
            name="code"
            type="text"
            label="Sicherheitscode"
            icon={LockKeyhole}
            placeholder="12345678"
            autoComplete="one-time-code"
            inputMode="numeric"
            pattern="[0-9]{8}"
            maxLength={8}
            value={otp}
            onChange={(event) =>
              setOtp(event.target.value.replace(/\D/g, "").slice(0, 8))
            }
            required
          />
          <AuthButton disabled={isSubmitting}>
            {isSubmitting ? "Code wird geprüft ..." : "Code bestätigen"}{" "}
            <ArrowRight className="size-4" />
          </AuthButton>
          <button
            type="button"
            className="w-full text-center text-xs text-[#0984E3] hover:text-[#00CEC9]"
            onClick={() => void requestCode()}
            disabled={isSubmitting}
          >
            Neuen Code anfordern
          </button>
        </form>
      ) : null}

      {step === "password" ? (
        <form className="space-y-5" onSubmit={resetPassword}>
          <AuthField
            id="password"
            name="password"
            type="password"
            label="Neues Passwort"
            icon={KeyRound}
            autoComplete="new-password"
            minLength={12}
            required
          />
          <AuthField
            id="passwordConfirmation"
            name="passwordConfirmation"
            type="password"
            label="Passwort wiederholen"
            icon={KeyRound}
            autoComplete="new-password"
            minLength={12}
            required
          />
          <AuthButton disabled={isSubmitting}>
            {isSubmitting ? "Passwort wird geändert ..." : "Passwort speichern"}{" "}
            <ArrowRight className="size-4" />
          </AuthButton>
        </form>
      ) : null}

      {error ? (
        <p
          className="mt-5 rounded-lg border border-red-400/25 bg-red-400/10 px-3 py-2 text-xs text-red-200"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      {notice ? (
        <p
          className="mt-5 rounded-lg border border-[#00CEC9]/25 bg-[#00CEC9]/10 px-3 py-2 text-xs text-[#b9fffb]"
          role="status"
        >
          {notice}
        </p>
      ) : null}

      <Link
        href="/login"
        className="mt-6 inline-flex items-center gap-2 text-xs text-white/30 hover:text-white/65"
      >
        <ArrowLeft className="size-3.5" /> Back to sign in
      </Link>
    </AuthPanel>
  );
}
