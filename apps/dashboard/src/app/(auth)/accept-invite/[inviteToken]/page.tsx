"use client";
import { MailCheck } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
export default function AcceptInvitePage() {
  const { inviteToken } = useParams<{ inviteToken: string }>();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  async function accept() {
    setLoading(true);
    const result = await authClient.organization.acceptInvitation({
      invitationId: inviteToken,
    });
    if (result.error)
      setError(
        result.error.message ?? "Einladung konnte nicht angenommen werden.",
      );
    else router.replace("/select-organization");
    setLoading(false);
  }
  return (
    <main className="mx-auto max-w-md p-8 text-center">
      <MailCheck className="mx-auto size-10 text-[#00cec9]" />
      <h1 className="mt-4 text-xl font-semibold">Einladung annehmen</h1>
      <button
        className="mt-6 rounded-xl bg-[#0984e3] px-4 py-2 text-white"
        disabled={loading}
        onClick={() => void accept()}
      >
        {loading ? "Wird angenommen …" : "Einladung annehmen"}
      </button>
      {error ? <p className="mt-4 text-red-300">{error}</p> : null}
    </main>
  );
}
