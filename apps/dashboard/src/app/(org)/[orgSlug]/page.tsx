"use client";

import { useQuery } from "@tanstack/react-query";
import { Database, Globe2, GitBranch, Plus, Server, XCircle } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { ResourceStatusBadge } from "@/components/resources/resource-status-badge";
import { Button } from "@/components/ui/button";

type DashboardData = {
  projects: { total: number; healthy: number };
  databases: { total: number; ready: number; failed: number };
  domains: number;
  allocated: { cpuMillicores: number; memoryMib: number; storageGib: number };
  recentProjects: { id: string; name: string; slug: string; status: string; branch: string; updatedAt: string }[];
};

function StatCard({ icon: Icon, label, value, sub, accent }: { icon: typeof Server; label: string; value: string | number; sub?: string; accent?: string }) {
  return <section className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#172128]/90 p-5 shadow-[0_12px_32px_rgba(0,0,0,.1)]"><div className="flex items-start justify-between"><div><p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p><p className={`mt-2 text-2xl font-bold tabular-nums ${accent ?? "text-zinc-100"}`}>{value}</p>{sub ? <p className="mt-0.5 text-xs text-zinc-500">{sub}</p> : null}</div><div className="rounded-xl border border-white/[0.06] bg-white/[0.04] p-2.5"><Icon className="size-4 text-[#81ecec]" /></div></div></section>;
}

function dateLabel(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "Unbekannt" : new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(date); }

export default function OrgOverviewPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const router = useRouter();
  const { data, isLoading, isError, refetch } = useQuery<DashboardData>({
    queryKey: ["orgs", orgSlug, "dashboard"],
    queryFn: async () => { const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? ""}/organizations/${orgSlug}/dashboard`, { credentials: "include" }); if (!response.ok) throw new Error("Dashboard-Daten nicht verfügbar"); return response.json(); },
  });

  return <div className="space-y-6 p-5 sm:p-7">
    <div className="flex flex-wrap items-start justify-between gap-4"><PageHeader title="Übersicht" description="Aktueller Zustand von Projekten, Datenbanken und Domains dieser Organisation." /><div className="flex gap-2"><Button variant="outline" onClick={() => router.push(`/${orgSlug}/databases/new`)}><Database className="size-3.5" /> Datenbank</Button><Button onClick={() => router.push(`/${orgSlug}/projects/new`)}><Plus className="size-3.5" /> Projekt</Button></div></div>
    {isError ? <div className="rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-100">Die Übersichts-Daten konnten nicht geladen werden. <button type="button" onClick={() => refetch()} className="ml-2 underline underline-offset-2">Erneut versuchen</button></div> : null}
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard icon={GitBranch} label="Projekte" value={isLoading ? "—" : data?.projects.total ?? 0} sub={`${data?.projects.healthy ?? 0} gesund`} /><StatCard icon={Database} label="Datenbanken" value={isLoading ? "—" : data?.databases.total ?? 0} sub={`${data?.databases.ready ?? 0} bereit`} /><StatCard icon={XCircle} label="Fehlgeschlagene DBs" value={isLoading ? "—" : data?.databases.failed ?? 0} accent={data?.databases.failed ? "text-red-400" : undefined} /><StatCard icon={Globe2} label="Domains" value={isLoading ? "—" : data?.domains ?? 0} sub="Organisationweit" /></div>
    <div className="grid gap-4 lg:grid-cols-3"><section className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#172128]/90 lg:col-span-2"><div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4"><h2 className="text-sm font-semibold text-zinc-100">Zuletzt aktualisierte Projekte</h2><Button variant="ghost" size="sm" onClick={() => router.push(`/${orgSlug}/projects`)}>Alle Projekte</Button></div><div className="divide-y divide-white/[0.04]">{isLoading ? <div className="space-y-3 p-5">{[1, 2, 3].map((item) => <div key={item} className="h-10 animate-pulse rounded bg-white/[0.04]" />)}</div> : null}{data?.recentProjects.map((project) => <button key={project.id} type="button" onClick={() => router.push(`/${orgSlug}/projects/${project.id}`)} className="flex w-full items-center gap-4 px-5 py-3.5 text-left transition hover:bg-white/[0.03]"><div className="rounded-lg bg-[#0984e3]/10 p-2"><GitBranch className="size-3.5 text-[#81ecec]" /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-zinc-100">{project.name}</p><p className="mt-0.5 text-xs text-zinc-500">{project.slug} · {project.branch}</p></div><div className="text-right"><ResourceStatusBadge status={project.status} /><p className="mt-1 text-[11px] text-zinc-600">{dateLabel(project.updatedAt)}</p></div></button>)}{!isLoading && !data?.recentProjects.length ? <p className="px-5 py-10 text-center text-sm text-zinc-500">Noch keine Projekte vorhanden.</p> : null}</div></section><section className="rounded-2xl border border-white/[0.07] bg-[#172128]/90"><div className="border-b border-white/[0.06] px-5 py-4"><h2 className="text-sm font-semibold text-zinc-100">Zugewiesene Ressourcen</h2><p className="mt-0.5 text-xs text-zinc-500">Aktuell aus verwalteten Datenbanken</p></div><div className="space-y-4 p-5"><div><p className="text-xs text-zinc-500">CPU</p><p className="mt-1 text-lg font-semibold text-zinc-100">{isLoading ? "—" : `${data?.allocated.cpuMillicores ?? 0} mCPU`}</p></div><div><p className="text-xs text-zinc-500">Arbeitsspeicher</p><p className="mt-1 text-lg font-semibold text-zinc-100">{isLoading ? "—" : `${data?.allocated.memoryMib ?? 0} MiB`}</p></div><div><p className="text-xs text-zinc-500">Speicher</p><p className="mt-1 text-lg font-semibold text-zinc-100">{isLoading ? "—" : `${data?.allocated.storageGib ?? 0} GiB`}</p></div></div></section></div>
  </div>;
}
