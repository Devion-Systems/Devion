"use client";

import { KeyRound, ShieldCheck, Terminal } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";

export default function AccountApiKeysPage() {
  return (
    <div className="space-y-6 py-1">
      <PageHeader
        title="API-Keys"
        description="Persönliche Zugänge für CLI, Automatisierungen und Integrationen."
      />
      <section className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#172128]/90 shadow-[0_12px_32px_rgba(0,0,0,.1)]">
        <div className="border-b border-white/[0.06] p-5">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl border border-[#00cec9]/15 bg-[#00cec9]/[0.06]">
              <KeyRound className="h-4 w-4 text-[#81ecec]" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">
                Sichere API-Zugänge
              </h2>
              <p className="mt-1 text-xs leading-5 text-zinc-500">
                Keys werden nur einmal vollständig angezeigt und können
                jederzeit widerrufen werden.
              </p>
            </div>
          </div>
        </div>
        <div className="p-5">
          <div className="rounded-xl border border-white/[0.06] bg-[#0b1217]/60 p-4 font-mono text-xs">
            <div className="flex items-center gap-2 text-zinc-600">
              <Terminal className="h-3.5 w-3.5 text-[#81ecec]" />
              DEVION_API_KEY
            </div>
            <p className="mt-3 select-none tracking-[0.18em] text-zinc-400">
              ••••••••••••••••••••••••
            </p>
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs text-zinc-600">
            <ShieldCheck className="h-3.5 w-3.5 text-[#00cec9]" />
            Die Verwaltung wird verfügbar, sobald API-Keys angebunden sind.
          </div>
        </div>
      </section>
    </div>
  );
}
