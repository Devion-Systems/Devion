"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Laptop, LogIn, LogOut, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { useSession } from "@/features/auth/hooks/hooks";
import { authClient } from "@/lib/auth-client";

export default function AccountSessionsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: currentSession } = useSession();
  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["auth", "multi-sessions"],
    queryFn: async () => {
      const { data, error } =
        await authClient.multiSession.listDeviceSessions();
      if (error)
        throw new Error(
          error.message ?? "Konten konnten nicht geladen werden.",
        );
      return data ?? [];
    },
  });

  async function activate(sessionToken: string) {
    const { error } = await authClient.multiSession.setActive({ sessionToken });
    if (error) return;
    await queryClient.invalidateQueries({ queryKey: ["auth", "session"] });
    router.replace("/select-organization");
    router.refresh();
  }

  async function revoke(sessionToken: string) {
    await authClient.multiSession.revoke({ sessionToken });
    await queryClient.invalidateQueries({
      queryKey: ["auth", "multi-sessions"],
    });
  }

  return (
    <div className="space-y-6 py-1">
      <PageHeader
        title="Konten in diesem Browser"
        description="Wechsle schnell zwischen bis zu fünf Devion-Konten oder entferne nicht mehr benötigte Anmeldungen."
      />
      <section className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#172128]/90">
        <div className="flex items-center justify-between gap-4 border-b border-white/[0.06] p-5">
          <p className="text-sm text-zinc-400">
            Zum Hinzufügen eines weiteren Kontos erneut anmelden.
          </p>
          <Button asChild size="sm">
            <Link href="/login">
              <Plus /> Konto hinzufügen
            </Link>
          </Button>
        </div>
        {isLoading ? (
          <p className="p-5 text-sm text-zinc-500">Konten werden geladen …</p>
        ) : null}
        {!isLoading && sessions.length === 0 ? (
          <p className="p-5 text-sm text-zinc-500">Keine Konten gefunden.</p>
        ) : null}
        {sessions.map(({ session, user }) => {
          const isActive = currentSession?.session.token === session.token;
          return (
            <div
              className="flex items-center gap-4 border-b border-white/[0.06] p-5 last:border-0"
              key={session.id}
            >
              <span className="grid size-9 place-items-center rounded-xl bg-white/[0.05]">
                <Laptop className="size-4 text-[#81ecec]" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-zinc-200">
                  {user.name || user.email}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  {user.email} · {session.userAgent ?? "Unbekanntes Gerät"}
                </p>
              </div>
              {isActive ? (
                <span className="rounded-full bg-[#00cec9]/10 px-2.5 py-1 text-xs font-medium text-[#81ecec]">
                  Aktiv
                </span>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void activate(session.token)}
                >
                  <LogIn /> Wechseln
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => void revoke(session.token)}
              >
                <LogOut /> Entfernen
              </Button>
            </div>
          );
        })}
      </section>
    </div>
  );
}
