"use client";

import { MonitorSmartphone, ShieldCheck } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";

import { authClient } from "@/lib/auth-client";
import { useSession } from "@/features/auth/hooks/hooks";

import {
  AuthButton,
  AuthField,
  AuthHeader,
  AuthPanel,
} from "../_components/AuthPrimitives";

function normalizeCode(code: string) {
  return code
    .trim()
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();
}

export default function DeviceAuthorizationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, isLoading } = useSession();
  const [userCode, setUserCode] = useState(searchParams.get("user_code") ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isLoading || session?.user) return;
    const code = normalizeCode(userCode);
    const next = code
      ? `/device?user_code=${encodeURIComponent(code)}`
      : "/device";
    router.replace(`/login?next=${encodeURIComponent(next)}`);
  }, [isLoading, router, session?.user, userCode]);

  async function continueAuthorization(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = normalizeCode(userCode);
    if (code.length !== 8) {
      setError("Bitte gib den achtstelligen Code aus der Devion CLI ein.");
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      const { data, error: verificationError } = await authClient.device({
        query: { user_code: code },
      });
      if (verificationError || !data) {
        setError("Dieser Gerätecode ist ungültig oder bereits abgelaufen.");
        return;
      }
      router.push(`/device/approve?user_code=${encodeURIComponent(code)}`);
    } catch {
      setError(
        "Der Gerätecode konnte nicht geprüft werden. Bitte versuche es erneut.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading || !session?.user) return null;

  return (
    <AuthPanel>
      <AuthHeader
        eyebrow="Devion CLI"
        title="Gerät verbinden"
        description="Gib den Code ein, der in deiner Devion CLI angezeigt wird."
      />
      <form className="space-y-5" onSubmit={continueAuthorization}>
        <AuthField
          id="device-code"
          name="code"
          type="text"
          label="Gerätecode"
          icon={MonitorSmartphone}
          placeholder="ABCD1234"
          autoComplete="one-time-code"
          maxLength={12}
          value={userCode}
          onChange={(event) => setUserCode(normalizeCode(event.target.value))}
          required
        />
        <p className="flex gap-2 rounded-lg border border-amber-300/20 bg-amber-300/[0.07] p-3 text-xs leading-5 text-amber-100/75">
          <ShieldCheck className="mt-0.5 size-4 shrink-0" />
          Bestätige nur einen Code, der gerade in deiner eigenen Devion CLI
          angezeigt wird.
        </p>
        <AuthButton disabled={isSubmitting}>
          {isSubmitting ? "Wird geprüft …" : "Weiter"}
        </AuthButton>
      </form>
      {error ? (
        <p className="mt-5 text-center text-xs text-red-200">{error}</p>
      ) : null}
    </AuthPanel>
  );
}
