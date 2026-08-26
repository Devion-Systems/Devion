"use client";

import { Check, ShieldAlert, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { authClient } from "@/lib/auth-client";
import { useSession } from "@/features/auth/hooks/hooks";

import { AuthHeader, AuthPanel } from "../../_components/AuthPrimitives";

function normalizeCode(code: string | null) {
  return (code ?? "")
    .trim()
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();
}

type DeviceRequest = { client_id?: string; scope?: string };

export default function DeviceApprovalPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const userCode = normalizeCode(searchParams.get("user_code"));
  const { data: session, isLoading } = useSession();
  const [request, setRequest] = useState<DeviceRequest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (!session?.user) {
      router.replace(
        `/login?next=${encodeURIComponent(`/device/approve?user_code=${userCode}`)}`,
      );
      return;
    }
    if (userCode.length !== 8) {
      router.replace("/device");
      return;
    }
    void authClient
      .device({ query: { user_code: userCode } })
      .then(({ data, error: requestError }) => {
        if (requestError || !data) {
          setError("Die Anfrage ist ungültig oder abgelaufen.");
          return;
        }
        setRequest(data);
      });
  }, [isLoading, router, session?.user, userCode]);

  async function decide(approved: boolean) {
    if (!request) return;
    setError(null);
    setIsProcessing(true);
    try {
      const result = approved
        ? await authClient.device.approve({ userCode })
        : await authClient.device.deny({ userCode });
      if (result.error) {
        setError(
          result.error.error_description ??
            "Die Anfrage konnte nicht verarbeitet werden.",
        );
        return;
      }
      router.replace(approved ? "/device/success" : "/device");
    } catch {
      setError(
        "Die Anfrage konnte nicht verarbeitet werden. Bitte versuche es erneut.",
      );
    } finally {
      setIsProcessing(false);
    }
  }

  if (isLoading || !session?.user || !request) {
    return (
      <AuthPanel>
        <AuthHeader
          eyebrow="Devion CLI"
          title="Anfrage wird geprüft"
          description={error ?? "Bitte einen Moment warten."}
        />
      </AuthPanel>
    );
  }

  return (
    <AuthPanel>
      <AuthHeader
        eyebrow="Sicherheitsbestätigung"
        title="CLI autorisieren?"
        description="Damit erhält die Devion CLI Zugriff auf dein Konto."
      />
      <div className="space-y-4 rounded-xl border border-white/[0.09] bg-white/[0.025] p-4 text-sm">
        <p>
          <span className="text-white/40">Client</span>
          <br />
          <span className="font-medium text-white">
            {request.client_id ?? "Devion CLI"}
          </span>
        </p>
        <p>
          <span className="text-white/40">Berechtigungen</span>
          <br />
          <span className="font-medium text-white">
            {request.scope || "Standard-API-Zugriff"}
          </span>
        </p>
        <p>
          <span className="text-white/40">Code</span>
          <br />
          <span className="font-mono font-medium text-white">{userCode}</span>
        </p>
      </div>
      <p className="mt-4 flex gap-2 text-xs leading-5 text-amber-100/75">
        <ShieldAlert className="mt-0.5 size-4 shrink-0" />
        Stimme nur zu, wenn dieser Code in deiner eigenen CLI steht.
      </p>
      <div className="mt-6 grid grid-cols-2 gap-3">
        <button
          type="button"
          disabled={isProcessing}
          onClick={() => void decide(false)}
          className="flex h-11 items-center justify-center gap-2 rounded-xl border border-white/[0.12] text-sm text-white/70 hover:bg-white/[0.05] disabled:opacity-50"
        >
          <X className="size-4" />
          Ablehnen
        </button>
        <button
          type="button"
          disabled={isProcessing}
          onClick={() => void decide(true)}
          className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[#0984E3] text-sm font-semibold text-white hover:bg-[#00a8ff] disabled:opacity-50"
        >
          <Check className="size-4" />
          {isProcessing ? "Wird bestätigt …" : "Autorisieren"}
        </button>
      </div>
      {error ? (
        <p className="mt-5 text-center text-xs text-red-200">{error}</p>
      ) : null}
    </AuthPanel>
  );
}
