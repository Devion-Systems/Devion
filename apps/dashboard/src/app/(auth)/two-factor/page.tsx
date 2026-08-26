"use client";

import { ArrowRight, LockKeyhole } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { authClient } from "@/lib/auth-client";
import {
  AuthButton,
  AuthField,
  AuthHeader,
  AuthPanel,
} from "../_components/AuthPrimitives";

export default function TwoFactorPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setError(
        "Bitte gib den sechsstelligen Code aus deiner Authenticator-App ein.",
      );
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const { error: verificationError } =
        await authClient.twoFactor.verifyTotp({ code });
      if (verificationError) {
        setError(
          "Der Code ist ungültig oder abgelaufen. Bitte versuche es erneut.",
        );
        return;
      }
      router.replace("/select-organization");
      router.refresh();
    } catch {
      setError("Der Authentifizierungsdienst ist gerade nicht erreichbar.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthPanel>
      <AuthHeader
        eyebrow="Sicherheitsprüfung"
        title="Code bestätigen."
        description="Gib den aktuellen Code aus deiner Authenticator-App ein."
      />
      <form className="space-y-5" onSubmit={verify}>
        <AuthField
          id="two-factor-code"
          name="code"
          type="text"
          label="Authenticator-Code"
          icon={LockKeyhole}
          placeholder="123456"
          autoComplete="one-time-code"
          inputMode="numeric"
          pattern="[0-9]{6}"
          maxLength={6}
          value={code}
          onChange={(event) =>
            setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
          }
          required
        />
        <AuthButton disabled={isSubmitting}>
          {isSubmitting ? "Wird geprüft …" : "Anmelden"}
          <ArrowRight className="size-4" />
        </AuthButton>
      </form>
      {error ? (
        <p
          className="mt-5 rounded-lg border border-red-400/25 bg-red-400/10 px-3 py-2 text-xs text-red-200"
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </AuthPanel>
  );
}
