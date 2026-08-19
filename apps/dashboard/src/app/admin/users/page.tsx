"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Search, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";

type UserAnalytics = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  role?: string | null;
  createdAt: string;
  lastSeenAt?: string | null;
};

export default function AdminUsersPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin", "analytics", "users"],
    queryFn: async () => {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? ""}/api/admin/analytics/users`,
        { credentials: "include" },
      );
      if (!response.ok)
        throw new Error("Nutzeranalysen konnten nicht geladen werden.");
      return response.json() as Promise<UserAnalytics[]>;
    },
  });
  const filtered = useMemo(
    () =>
      users.filter((user) =>
        `${user.name} ${user.email}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [query, users],
  );

  return (
    <div className="space-y-6 p-5 sm:p-7">
      <PageHeader
        title="Nutzeranalysen"
        description="Kontostatus, Aktivität und Organisationszugriff plattformweit prüfen."
      />
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-600" />
        <input
          className="h-10 w-full rounded-xl border border-white/[0.08] bg-[#172128] pl-9 pr-3 text-sm outline-none focus:border-[#00cec9]/60"
          placeholder="Nutzer suchen …"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <section className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#172128]/90">
        {isLoading ? (
          <p className="p-5 text-sm text-zinc-500">Nutzer werden geladen …</p>
        ) : null}
        {!isLoading && filtered.length === 0 ? (
          <div className="p-12 text-center text-sm text-zinc-500">
            <Users className="mx-auto mb-3 size-7" />
            Keine Nutzer gefunden.
          </div>
        ) : null}
        {filtered.map((user) => (
          <button
            className="flex w-full items-center gap-4 border-b border-white/[0.06] p-5 text-left transition hover:bg-white/[0.03] last:border-0"
            key={user.id}
            onClick={() => router.push(`/admin/users/${user.id}`)}
            type="button"
          >
            <span className="grid size-9 place-items-center rounded-full bg-[#0984e3]/15 text-sm font-semibold text-[#74b9ff]">
              {user.name.slice(0, 1).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-zinc-200">
                {user.name}
              </span>
              <span className="block truncate text-xs text-zinc-500">
                {user.email}
              </span>
            </span>
            <span className="hidden text-xs text-zinc-500 sm:block">
              {user.lastSeenAt
                ? `Aktiv ${new Date(user.lastSeenAt).toLocaleDateString("de-DE")}`
                : "Noch nicht aktiv"}
            </span>
            <span
              className={
                user.emailVerified
                  ? "text-xs text-[#81ecec]"
                  : "text-xs text-amber-300"
              }
            >
              {user.emailVerified ? "Verifiziert" : "Unbestätigt"}
            </span>
            <ChevronRight className="size-4 text-zinc-600" />
          </button>
        ))}
      </section>
    </div>
  );
}
