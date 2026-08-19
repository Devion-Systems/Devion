"use client";

import { Activity, Boxes, Building2, Server, Users } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";

const metrics = [
  {
    label: "Organisationen",
    value: "—",
    hint: "Auf der Plattform",
    icon: Building2,
    color: "text-[#81ecec]",
  },
  {
    label: "Aktive Nutzer",
    value: "—",
    hint: "In den letzten 30 Tagen",
    icon: Users,
    color: "text-[#74b9ff]",
  },
  {
    label: "Verbundene Nodes",
    value: "—",
    hint: "Cluster-Kapazität",
    icon: Server,
    color: "text-emerald-400",
  },
  {
    label: "Deployments",
    value: "—",
    hint: "Heute verarbeitet",
    icon: Boxes,
    color: "text-violet-300",
  },
];

export default function AdminPage() {
  return (
    <div className="space-y-6 p-5 sm:p-7">
      <PageHeader
        title="Plattform-Übersicht"
        description="Der zentrale Blick auf Organisationen, Auslastung und Plattform-Zustand."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(({ label, value, hint, icon: Icon, color }) => (
          <div
            key={label}
            className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#172128]/90 p-5 shadow-[0_12px_32px_rgba(0,0,0,.1)]"
          >
            <div className="absolute -right-5 -top-5 h-20 w-20 rounded-full bg-[#0984e3]/[0.07] blur-2xl" />
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  {label}
                </p>
                <p className="mt-2 text-2xl font-bold tabular-nums text-zinc-100">
                  {value}
                </p>
                <p className="mt-1 text-xs text-zinc-600">{hint}</p>
              </div>
              <span className="rounded-xl border border-white/[0.06] bg-white/[0.04] p-2.5">
                <Icon className={`h-4 w-4 ${color}`} />
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-2xl border border-white/[0.07] bg-[#172128]/90 shadow-[0_12px_32px_rgba(0,0,0,.1)]">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">
                Plattform-Aktivität
              </h2>
              <p className="mt-0.5 text-xs text-zinc-500">
                Ereignisse erscheinen hier, sobald Daten angebunden sind.
              </p>
            </div>
            <Activity className="h-4 w-4 text-[#81ecec]" />
          </div>
          <div className="flex min-h-56 flex-col items-center justify-center px-5 text-center">
            <span className="grid h-11 w-11 place-items-center rounded-2xl border border-[#00cec9]/15 bg-[#00cec9]/[0.06]">
              <Activity className="h-5 w-5 text-[#81ecec]" />
            </span>
            <p className="mt-4 text-sm font-medium text-zinc-300">
              Bereit für Live-Daten
            </p>
            <p className="mt-1 max-w-xs text-xs leading-5 text-zinc-600">
              Deployments, Änderungen und Systemereignisse werden hier
              chronologisch zusammengeführt.
            </p>
          </div>
        </section>
        <section className="rounded-2xl border border-white/[0.07] bg-[#172128]/90 p-5 shadow-[0_12px_32px_rgba(0,0,0,.1)]">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">
                Systemzustand
              </h2>
              <p className="mt-0.5 text-xs text-zinc-500">Live-Verfügbarkeit</p>
            </div>
            <span className="flex items-center gap-1.5 rounded-full border border-[#00cec9]/15 bg-[#00cec9]/[0.06] px-2.5 py-1 text-xs text-[#81ecec]">
              <span className="devion-status-dot h-1.5 w-1.5 rounded-full bg-[#00cec9]" />
              Online
            </span>
          </div>
          <div className="mt-6 space-y-4">
            {["API Gateway", "Scheduler", "Worker Pool"].map((service) => (
              <div
                key={service}
                className="flex items-center justify-between border-b border-white/[0.05] pb-3 last:border-0 last:pb-0"
              >
                <span className="text-sm text-zinc-400">{service}</span>
                <span className="font-mono text-xs text-[#81ecec]">
                  Operational
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
