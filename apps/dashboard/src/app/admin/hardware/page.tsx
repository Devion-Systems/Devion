"use client";

import { Cpu, HardDrive, Network } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";

export default function AdminHardwarePage() {
  return (
    <div className="space-y-6 p-5 sm:p-7">
      <PageHeader
        title="Hardware-Pool"
        description="Kapazitäten, Nodes und Verbindungen der Plattform-Infrastruktur."
      />
      <div className="grid gap-4 md:grid-cols-3">
        {[
          { label: "Rechenleistung", icon: Cpu },
          { label: "Speicher", icon: HardDrive },
          { label: "Netzwerk", icon: Network },
        ].map(({ label, icon: Icon }) => (
          <section
            key={label}
            className="rounded-2xl border border-white/[0.07] bg-[#172128]/90 p-5 shadow-[0_12px_32px_rgba(0,0,0,.1)]"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-zinc-300">{label}</span>
              <span className="rounded-xl border border-white/[0.06] bg-white/[0.04] p-2">
                <Icon className="h-4 w-4 text-[#81ecec]" />
              </span>
            </div>
            <p className="mt-7 text-2xl font-bold text-zinc-100">—</p>
            <p className="mt-1 text-xs text-zinc-600">
              Wird nach der Node-Anbindung angezeigt
            </p>
            <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
              <div className="h-full w-0 rounded-full bg-[#00cec9]" />
            </div>
          </section>
        ))}
      </div>
      <section className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.11] bg-[#172128]/45 px-5 text-center">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#00cec9]/[0.06] text-[#81ecec]">
          <Network className="h-5 w-5" />
        </span>
        <h2 className="mt-4 text-sm font-medium text-zinc-300">
          Der Pool ist bereit
        </h2>
        <p className="mt-1 max-w-sm text-xs leading-5 text-zinc-600">
          Verbundene Nodes und ihre Auslastung werden als Karten mit Live-Status
          in diesem Bereich dargestellt.
        </p>
      </section>
    </div>
  );
}
