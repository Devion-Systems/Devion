"use client";

import { Building2, Search, UsersRound } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";

export default function AdminOrganizationsPage() {
  return (
    <div className="space-y-6 p-5 sm:p-7">
      <PageHeader
        title="Organisationen"
        description="Organisationen auf der Plattform zentral prüfen und verwalten."
      />
      <section className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#172128]/90 shadow-[0_12px_32px_rgba(0,0,0,.1)]">
        <div className="flex flex-col gap-3 border-b border-white/[0.06] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-600" />
            <input
              aria-label="Organisationen suchen"
              placeholder="Organisationen durchsuchen …"
              className="h-9 w-full rounded-xl border border-white/[0.08] bg-white/[0.035] pl-9 pr-3 text-sm text-zinc-200 placeholder:text-zinc-600 outline-none transition focus:border-[#00cec9]/50 focus:ring-4 focus:ring-[#00cec9]/10"
            />
          </div>
          <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-zinc-600">
            Live-Verzeichnis
          </span>
        </div>
        <div className="flex min-h-72 flex-col items-center justify-center px-5 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-2xl border border-[#0984e3]/20 bg-[#0984e3]/[0.08]">
            <Building2 className="h-5 w-5 text-[#74b9ff]" />
          </span>
          <h2 className="mt-4 text-sm font-semibold text-zinc-200">
            Noch keine Organisationen geladen
          </h2>
          <p className="mt-1 max-w-sm text-xs leading-5 text-zinc-600">
            Nach dem Verbinden der Verwaltungsdaten erscheinen hier
            Organisationen, Mitglieder und ihr aktueller Status.
          </p>
          <div className="mt-5 flex items-center gap-2 rounded-full border border-white/[0.07] bg-white/[0.025] px-3 py-1.5 text-xs text-zinc-500">
            <UsersRound className="h-3.5 w-3.5 text-[#81ecec]" />
            Zentrale Mitgliederverwaltung
          </div>
        </div>
      </section>
    </div>
  );
}
