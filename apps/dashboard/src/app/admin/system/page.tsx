"use client";

import { CheckCircle2, CircleDotDashed, Database, Server } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";

const services = [
  {
    name: "API Gateway",
    description: "Request Routing und Authentifizierung",
    icon: Server,
  },
  {
    name: "Control Database",
    description: "Persistenz und Konfiguration",
    icon: Database,
  },
  {
    name: "Build Queue",
    description: "Deployments und Hintergrundaufgaben",
    icon: CircleDotDashed,
  },
];

export default function AdminSystemPage() {
  return (
    <div className="space-y-6 p-5 sm:p-7">
      <PageHeader
        title="System-Health"
        description="Verfügbarkeit und Zustand der zentralen Plattformdienste."
      />
      <div className="grid gap-4 md:grid-cols-3">
        {services.map(({ name, description, icon: Icon }) => (
          <article
            key={name}
            className="rounded-2xl border border-white/[0.07] bg-[#172128]/90 p-5 shadow-[0_12px_32px_rgba(0,0,0,.1)]"
          >
            <div className="flex items-start justify-between">
              <span className="rounded-xl border border-white/[0.06] bg-white/[0.04] p-2.5">
                <Icon className="h-4 w-4 text-[#81ecec]" />
              </span>
              <CheckCircle2 className="h-4 w-4 text-[#00cec9]" />
            </div>
            <h2 className="mt-5 text-sm font-semibold text-zinc-100">{name}</h2>
            <p className="mt-1 text-xs leading-5 text-zinc-500">
              {description}
            </p>
            <div className="mt-5 flex items-center gap-2 border-t border-white/[0.05] pt-3 text-xs text-[#81ecec]">
              <span className="devion-status-dot h-1.5 w-1.5 rounded-full bg-[#00cec9]" />
              Keine Störungen
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
