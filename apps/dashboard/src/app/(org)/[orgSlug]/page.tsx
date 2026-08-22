"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, Database, GitBranch, Plus, RefreshCw, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { DesignEmptyState } from "@/components/layout/design-empty-state";
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

const api = (path: string) => `${process.env.NEXT_PUBLIC_API_URL ?? ""}${path}`;
const formatNumber = new Intl.NumberFormat("de-DE");

function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Unbekannt"
    : new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default function OrgOverviewPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const { data, isLoading, isError, refetch } = useQuery<DashboardData>({
    queryKey: ["orgs", orgSlug, "dashboard"],
    queryFn: async () => {
      const response = await fetch(api(`/organizations/${orgSlug}/dashboard`), { credentials: "include" });
      if (!response.ok) throw new Error("Dashboard-Daten nicht verfügbar");
      return response.json();
    },
  });

  const failedDatabases = data?.databases.failed ?? 0;
  const projectTotal = data?.projects.total ?? 0;
  const healthyProjects = data?.projects.healthy ?? 0;
  const hasAttention = failedDatabases > 0;

  return (
    <main className="flex flex-col gap-6 p-5 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1"><PageHeader title="Übersicht" description="Was gerade läuft und was deine Aufmerksamkeit braucht." /></div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="lg" variant="outline"><Link href={`/${orgSlug}/databases/new`}><Database data-icon="inline-start" />Datenbank</Link></Button>
          <Button asChild size="lg"><Link href={`/${orgSlug}/projects/new`}><Plus data-icon="inline-start" />Projekt erstellen</Link></Button>
        </div>
      </div>

      {isError ? <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-100"><span>Die Übersicht konnte nicht geladen werden. Prüfe die Verbindung und versuche es erneut.</span><Button size="sm" variant="outline" onClick={() => void refetch()}><RefreshCw data-icon="inline-start" />Erneut laden</Button></div> : null}

      <section aria-label="Betriebszustand" className="border-y border-white/[0.08] py-5">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-center">
          <div className="min-w-0">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[#00cec9]/80">Betriebszustand</p>
            {isLoading ? <p className="mt-2 text-lg font-medium text-zinc-300">Status wird geladen …</p> : hasAttention ? <div className="mt-2 flex items-center gap-2 text-lg font-medium text-red-200"><TriangleAlert className="size-5 shrink-0" />{failedDatabases} {failedDatabases === 1 ? "Datenbank benötigt" : "Datenbanken benötigen"} Aufmerksamkeit</div> : <div className="mt-2 flex items-center gap-2 text-lg font-medium text-zinc-100"><CheckCircle2 className="size-5 shrink-0 text-[#00cec9]" />Keine Störung erkannt</div>}
            <p className="mt-1 text-sm text-zinc-500">{isLoading ? "Daten aus Projekten, Datenbanken und Domains werden zusammengeführt." : `${healthyProjects} von ${projectTotal} Projekten gesund · ${data?.databases.ready ?? 0} Datenbanken bereit · ${data?.domains ?? 0} Domains verbunden`}</p>
          </div>
          <dl className="grid grid-cols-3 gap-3 border-t border-white/[0.08] pt-4 lg:border-t-0 lg:border-l lg:pl-5 lg:pt-0">
            <div><dt className="text-xs text-zinc-500">Projekte</dt><dd className="mt-1 font-mono text-lg font-semibold tabular-nums text-zinc-100">{isLoading ? "—" : formatNumber.format(projectTotal)}</dd></div>
            <div><dt className="text-xs text-zinc-500">Datenbanken</dt><dd className="mt-1 font-mono text-lg font-semibold tabular-nums text-zinc-100">{isLoading ? "—" : formatNumber.format(data?.databases.total ?? 0)}</dd></div>
            <div><dt className="text-xs text-zinc-500">Domains</dt><dd className="mt-1 font-mono text-lg font-semibold tabular-nums text-zinc-100">{isLoading ? "—" : formatNumber.format(data?.domains ?? 0)}</dd></div>
          </dl>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <section className="min-w-0 overflow-hidden rounded-2xl border border-white/[0.08] bg-[#172128]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] px-5 py-4"><div><h2 className="font-medium text-zinc-100">Aktive Projekte</h2><p className="mt-1 text-sm text-zinc-500">Zuletzt geänderte Deployments und ihr aktueller Zustand.</p></div><Button asChild size="sm" variant="ghost"><Link href={`/${orgSlug}/projects`}>Alle Projekte<ArrowRight data-icon="inline-end" /></Link></Button></div>
          {isLoading ? <div aria-busy="true" className="divide-y divide-white/[0.06] px-5 py-2">{[1, 2, 3].map((item) => <div key={item} className="h-16 border-b border-white/[0.06] last:border-0" />)}</div> : null}
          {!isLoading && (data?.recentProjects.length ?? 0) > 0 ? <><div className="hidden overflow-x-auto md:block"><table className="w-full text-left text-sm"><thead className="border-b border-white/[0.08] text-xs uppercase tracking-wide text-zinc-500"><tr><th className="px-5 py-3 font-medium">Projekt</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Branch</th><th className="px-5 py-3 text-right font-medium">Letzte Änderung</th></tr></thead><tbody className="divide-y divide-white/[0.06]">{data?.recentProjects.map((project) => <tr key={project.id} className="hover:bg-white/[0.025]"><td className="px-5 py-4"><Link href={`/${orgSlug}/projects/${project.id}`} className="flex min-w-0 items-center gap-3 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#81ecec]"><GitBranch className="size-4 shrink-0 text-[#81ecec]" /><span className="min-w-0"><span className="block truncate font-medium text-zinc-100">{project.name}</span><span className="mt-0.5 block truncate font-mono text-xs text-zinc-500">{project.slug}</span></span></Link></td><td className="px-4 py-4"><ResourceStatusBadge status={project.status} /></td><td className="px-4 py-4 font-mono text-xs text-zinc-400">{project.branch}</td><td className="px-5 py-4 text-right text-xs text-zinc-500">{dateLabel(project.updatedAt)}</td></tr>)}</tbody></table></div><div className="divide-y divide-white/[0.06] md:hidden">{data?.recentProjects.map((project) => <Link key={project.id} href={`/${orgSlug}/projects/${project.id}`} className="flex items-center gap-3 px-4 py-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#81ecec]"><GitBranch className="size-4 shrink-0 text-[#81ecec]" /><span className="min-w-0 flex-1"><span className="block truncate font-medium text-zinc-100">{project.name}</span><span className="mt-1 block truncate font-mono text-xs text-zinc-500">{project.branch} · {dateLabel(project.updatedAt)}</span></span><ResourceStatusBadge status={project.status} /></Link>)}</div></> : null}
          {!isLoading && !isError && (data?.recentProjects.length ?? 0) === 0 ? <DesignEmptyState icon={GitBranch} title="Noch keine Projekte" description="Lege ein Projekt an, um Anwendungen und Deployments zentral zu verwalten." action={{ label: "Projekt erstellen", href: `/${orgSlug}/projects/new` }} /> : null}
        </section>

        <aside className="border-l-0 border-white/[0.08] xl:border-l xl:pl-6">
          <div><h2 className="font-medium text-zinc-100">Zugewiesene Ressourcen</h2><p className="mt-1 text-sm text-zinc-500">Aktuell reservierte Kapazität.</p></div>
          <dl className="mt-5 divide-y divide-white/[0.08] border-y border-white/[0.08]">{[["CPU", isLoading ? "—" : `${formatNumber.format(data?.allocated.cpuMillicores ?? 0)} mCPU`], ["Arbeitsspeicher", isLoading ? "—" : `${formatNumber.format(data?.allocated.memoryMib ?? 0)} MiB`], ["Speicher", isLoading ? "—" : `${formatNumber.format(data?.allocated.storageGib ?? 0)} GiB`]].map(([label, value]) => <div key={label} className="flex items-baseline justify-between gap-3 py-3"><dt className="text-sm text-zinc-500">{label}</dt><dd className="font-mono text-sm font-medium tabular-nums text-zinc-100">{value}</dd></div>)}</dl>
          <Button asChild size="sm" variant="ghost" className="mt-4"><Link href={`/${orgSlug}/resources/usage`}>Ressourcen ansehen<ArrowRight data-icon="inline-end" /></Link></Button>
        </aside>
      </div>
    </main>
  );
}
