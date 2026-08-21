"use client";

import { useQuery } from "@tanstack/react-query";
import { Database, Globe2, GitBranch, Server, XCircle } from "lucide-react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";

type DashboardData = {
  projects: { total: number; healthy: number };
  databases: { total: number; ready: number; failed: number };
  domains: number;
  allocated: { cpuMillicores: number; memoryMib: number; storageGib: number };
  recentProjects: { id: string; name: string; slug: string; status: string; branch: string; updatedAt: string }[];
};

function StatCard({ icon: Icon, label, value, sub, accent }: { icon: typeof Server; label: string; value: string | number; sub?: string; accent?: string }) {
  return <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#172128]/90 p-5 shadow-[0_12px_32px_rgba(0,0,0,.1)]">
    <div className="flex items-start justify-between"><div><p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p><p className={`mt-2 text-2xl font-bold tabular-nums ${accent ?? "text-zinc-100"}`}>{value}</p>{sub ? <p className="mt-0.5 text-xs text-zinc-600">{sub}</p> : null}</div><div className="rounded-xl border border-white/[0.06] bg-white/[0.04] p-2.5"><Icon className="size-4 text-[#81ecec]" /></div></div>
  </div>;
}

function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default function OrgOverviewPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const { data, isLoading, isError } = useQuery<DashboardData>({
    queryKey: ["orgs", orgSlug, "dashboard"],
    queryFn: async () => {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? ""}/organizations/${orgSlug}/dashboard`, { credentials: "include" });
      if (!response.ok) throw new Error("Dashboard-Daten nicht verfügbar");
      return response.json();
    },
  });
  const stats = data;
  return <div className="space-y-6 p-5 sm:p-7">
    <PageHeader title="Dashboard" description="Aktuelle Daten aus Projekten, Datenbanken und Domains dieser Organisation" />
    {isError ? <p className="rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200">Die Übersichts-Daten konnten nicht geladen werden.</p> : null}
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard icon={GitBranch} label="Projekte" value={isLoading ? "—" : stats?.projects.total ?? 0} sub={`${stats?.projects.healthy ?? 0} gesund`} />
      <StatCard icon={Database} label="Datenbanken" value={isLoading ? "—" : stats?.databases.total ?? 0} sub={`${stats?.databases.ready ?? 0} bereit`} />
      <StatCard icon={XCircle} label="Fehlgeschlagene DBs" value={isLoading ? "—" : stats?.databases.failed ?? 0} accent={stats?.databases.failed ? "text-red-400" : undefined} />
      <StatCard icon={Globe2} label="Domains" value={isLoading ? "—" : stats?.domains ?? 0} sub="Organisationweit" />
    </div>
    <div className="grid gap-4 lg:grid-cols-3">
      <section className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#172128]/90 lg:col-span-2">
        <div className="border-b border-white/[0.06] px-5 py-4"><h2 className="text-sm font-semibold text-zinc-100">Zuletzt aktualisierte Projekte</h2></div>
        <div className="divide-y divide-white/[0.04]">
          {(stats?.recentProjects ?? []).map((project) => <div key={project.id} className="flex items-center gap-4 px-5 py-3.5"><div className="rounded-lg bg-[#0984e3]/10 p-2"><GitBranch className="size-3.5 text-[#81ecec]" /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-zinc-100">{project.name}</p><p className="mt-0.5 text-xs text-zinc-500">{project.slug} · {project.branch}</p></div><div className="text-right"><p className="text-xs text-[#81ecec]">{project.status}</p><p className="mt-0.5 text-[11px] text-zinc-600">{dateLabel(project.updatedAt)}</p></div></div>)}
          {!isLoading && !stats?.recentProjects.length ? <p className="px-5 py-8 text-sm text-zinc-500">Noch keine Projekte vorhanden.</p> : null}
        </div>
      </section>
      <section className="rounded-2xl border border-white/[0.07] bg-[#172128]/90">
        <div className="border-b border-white/[0.06] px-5 py-4"><h2 className="text-sm font-semibold text-zinc-100">Zugewiesene Ressourcen</h2><p className="mt-0.5 text-xs text-zinc-500">Aus verwalteten Datenbanken</p></div>
        <div className="space-y-4 p-5"><div><p className="text-xs text-zinc-500">CPU</p><p className="mt-1 text-lg font-semibold text-zinc-100">{isLoading ? "—" : `${stats?.allocated.cpuMillicores ?? 0} mCPU`}</p></div><div><p className="text-xs text-zinc-500">Arbeitsspeicher</p><p className="mt-1 text-lg font-semibold text-zinc-100">{isLoading ? "—" : `${stats?.allocated.memoryMib ?? 0} MiB`}</p></div><div><p className="text-xs text-zinc-500">Speicher</p><p className="mt-1 text-lg font-semibold text-zinc-100">{isLoading ? "—" : `${stats?.allocated.storageGib ?? 0} GiB`}</p></div></div>
      </section>
    </div>
  </div>;
}
