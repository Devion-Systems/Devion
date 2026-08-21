"use client";

import { useQuery } from "@tanstack/react-query";
import { Activity, Boxes, Building2, Database, HardDrive, Server, Users } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";

type Health = { status: "ok" | "error"; latencyMs?: number };
type Overview = {
  generatedAt: string;
  totals: { users: number; activeUsers: number; verifiedUsers: number; organizations: number; teams: number; projects: number };
  services: { api: "ok" | "error"; database: Health; registry: "ok" | "error"; storage: "ok" | "error" };
  recentUsers: { id: string; name: string; email: string; emailVerified: boolean; createdAt: string }[];
};

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "";

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unbekannt" : new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function MetricCard({ label, value, hint, icon: Icon, tone = "text-[#81ecec]" }: { label: string; value: number; hint: string; icon: typeof Users; tone?: string }) {
  return <section className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#172128]/90 p-5 shadow-[0_12px_32px_rgba(0,0,0,.1)]"><div className="absolute -right-5 -top-5 size-20 rounded-full bg-[#0984e3]/[0.07] blur-2xl" /><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p><p className="mt-2 text-2xl font-bold tabular-nums text-zinc-100">{value}</p><p className="mt-1 text-xs text-zinc-600">{hint}</p></div><span className="rounded-xl border border-white/[0.06] bg-white/[0.04] p-2.5"><Icon className={`size-4 ${tone}`} /></span></div></section>;
}

function ServiceRow({ name, healthy, detail, icon: Icon }: { name: string; healthy: boolean; detail: string; icon: typeof Server }) {
  return <div className="flex items-center gap-3 border-b border-white/[0.05] py-3 last:border-0"><span className="grid size-8 place-items-center rounded-lg border border-white/[0.06] bg-white/[0.03]"><Icon className="size-3.5 text-zinc-400" /></span><span className="min-w-0 flex-1"><span className="block text-sm text-zinc-300">{name}</span><span className="block truncate text-xs text-zinc-600">{detail}</span></span><span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] font-medium ${healthy ? "border-[#00cec9]/20 bg-[#00cec9]/[0.07] text-[#81ecec]" : "border-red-400/20 bg-red-400/10 text-red-200"}`}><span className={`size-1.5 rounded-full ${healthy ? "bg-[#00cec9]" : "bg-red-400"}`} />{healthy ? "Online" : "Fehler"}</span></div>;
}

export default function AdminPage() {
  const overview = useQuery<Overview>({
    queryKey: ["admin", "analytics", "overview"],
    queryFn: async () => { const response = await fetch(`${apiUrl}/api/admin/analytics/overview`, { credentials: "include" }); if (!response.ok) throw new Error("Plattformdaten konnten nicht geladen werden."); return response.json(); },
    refetchInterval: 30_000,
  });
  const data = overview.data;

  return <div className="space-y-6 p-5 sm:p-7">
    <PageHeader title="Plattform-Übersicht" description="Live-Status, Nutzer und Ressourcen der Devion-Plattform." />
    {overview.isError ? <div className="rounded-xl border border-red-400/25 bg-red-400/10 px-4 py-3 text-sm text-red-100" role="alert">{overview.error.message}<button type="button" onClick={() => void overview.refetch()} className="ml-2 underline underline-offset-2">Erneut versuchen</button></div> : null}
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard label="Organisationen" value={data?.totals.organizations ?? 0} hint={`${data?.totals.teams ?? 0} Teams`} icon={Building2} />
      <MetricCard label="Aktive Nutzer" value={data?.totals.activeUsers ?? 0} hint={`${data?.totals.users ?? 0} registriert`} icon={Users} tone="text-[#74b9ff]" />
      <MetricCard label="Verifizierte Nutzer" value={data?.totals.verifiedUsers ?? 0} hint="E-Mail bestätigt" icon={Activity} tone="text-emerald-400" />
      <MetricCard label="Projekte" value={data?.totals.projects ?? 0} hint="Organisationsübergreifend" icon={Boxes} tone="text-violet-300" />
    </div>
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <section className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#172128]/90 shadow-[0_12px_32px_rgba(0,0,0,.1)]"><div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4"><div><h2 className="text-sm font-semibold text-zinc-100">Neue Nutzer</h2><p className="mt-0.5 text-xs text-zinc-500">Zuletzt erstellte Konten</p></div><Link href="/admin/users" className="text-xs font-medium text-[#81ecec] hover:text-white">Alle Nutzer</Link></div><div className="divide-y divide-white/[0.04]">{overview.isLoading ? <div className="space-y-3 p-5">{[1, 2, 3].map((item) => <div key={item} className="h-10 animate-pulse rounded bg-white/[0.04]" />)}</div> : null}{data?.recentUsers.map((user) => <Link key={user.id} href={`/admin/users/${user.id}`} className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-white/[0.03]"><span className="grid size-8 place-items-center rounded-full bg-[#0984e3]/15 text-xs font-semibold text-[#81ecec]">{user.name.slice(0, 1).toUpperCase()}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-zinc-100">{user.name}</span><span className="block truncate text-xs text-zinc-500">{user.email}</span></span><span className={`rounded-full px-2 py-1 text-[11px] ${user.emailVerified ? "bg-[#00cec9]/10 text-[#81ecec]" : "bg-amber-300/10 text-amber-200"}`}>{user.emailVerified ? "Verifiziert" : "Unbestätigt"}</span><span className="hidden text-xs text-zinc-600 xl:block">{formatDate(user.createdAt)}</span></Link>)}{!overview.isLoading && !data?.recentUsers.length ? <p className="px-5 py-10 text-center text-sm text-zinc-500">Noch keine Nutzer vorhanden.</p> : null}</div></section>
      <section className="rounded-2xl border border-white/[0.07] bg-[#172128]/90 p-5 shadow-[0_12px_32px_rgba(0,0,0,.1)]"><div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold text-zinc-100">Systemzustand</h2><p className="mt-0.5 text-xs text-zinc-500">Automatisch alle 30 Sekunden aktualisiert</p></div><Server className="size-4 text-[#81ecec]" /></div><div className="mt-4"><ServiceRow name="API Gateway" healthy={data?.services.api === "ok"} detail="Anfragen und Authentifizierung" icon={Activity} /><ServiceRow name="PostgreSQL" healthy={data?.services.database.status === "ok"} detail={data?.services.database.latencyMs != null ? `${data.services.database.latencyMs} ms Antwortzeit` : "Datenbankverbindung"} icon={Database} /><ServiceRow name="Container Registry" healthy={data?.services.registry === "ok"} detail="Images und Artefakte" icon={Boxes} /><ServiceRow name="Object Storage" healthy={data?.services.storage === "ok"} detail="Backups und Objektdateien" icon={HardDrive} /></div>{data?.generatedAt ? <p className="mt-3 text-right text-[11px] text-zinc-600">Stand: {formatDate(data.generatedAt)}</p> : null}</section>
    </div>
  </div>;
}
