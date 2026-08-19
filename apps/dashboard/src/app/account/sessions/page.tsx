"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Laptop, LogOut } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export default function AccountSessionsPage() {
  const queryClient = useQueryClient();
  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["auth", "sessions"],
    queryFn: async () => {
      const { data, error } = await authClient.listSessions();
      if (error)
        throw new Error(
          error.message ?? "Sitzungen konnten nicht geladen werden.",
        );
      return data ?? [];
    },
  });

  async function revoke(token: string) {
    await authClient.revokeSession({ token });
    await queryClient.invalidateQueries({ queryKey: ["auth", "sessions"] });
  }

  return (
    <div className="space-y-6 py-1">
      <PageHeader
        title="Aktive Sitzungen"
        description="Überprüfe Geräte und beende Sitzungen, die du nicht mehr benötigst."
      />
      <section className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#172128]/90">
        {isLoading ? (
          <p className="p-5 text-sm text-zinc-500">
            Sitzungen werden geladen …
          </p>
        ) : null}
        {!isLoading && sessions.length === 0 ? (
          <p className="p-5 text-sm text-zinc-500">
            Keine aktiven Sitzungen gefunden.
          </p>
        ) : null}
        {sessions.map((session) => (
          <div
            className="flex items-center gap-4 border-b border-white/[0.06] p-5 last:border-0"
            key={session.id}
          >
            <span className="grid size-9 place-items-center rounded-xl bg-white/[0.05]">
              <Laptop className="size-4 text-[#81ecec]" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-zinc-200">
                {session.userAgent ?? "Unbekanntes Gerät"}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                {session.ipAddress ?? "IP unbekannt"} · aktiv bis{" "}
                {new Date(session.expiresAt).toLocaleDateString("de-DE")}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => revoke(session.token)}
            >
              <LogOut /> Beenden
            </Button>
          </div>
        ))}
      </section>
    </div>
  );
}
