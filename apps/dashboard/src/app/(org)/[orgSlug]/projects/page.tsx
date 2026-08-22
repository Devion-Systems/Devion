"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRight, FolderGit2, GitBranch, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { DesignEmptyState } from "@/components/layout/design-empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { ResourceStatusBadge } from "@/components/resources/resource-status-badge";
import { Button } from "@/components/ui/button";

type Project = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  branch: string;
  updatedAt: string;
};

const api = (path: string) => `${process.env.NEXT_PUBLIC_API_URL ?? ""}${path}`;

function useProjects(orgSlug: string) {
  return useQuery<Project[]>({
    queryKey: ["orgs", orgSlug, "projects"],
    queryFn: async () => {
      const response = await fetch(api(`/organizations/${orgSlug}/projects`), { credentials: "include" });
      if (!response.ok) throw new Error("Projekte konnten nicht geladen werden");
      return response.json();
    },
  });
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Unbekannt"
    : new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default function ProjectsPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const { data: projects = [], isLoading, isError, refetch } = useProjects(orgSlug);
  const [search, setSearch] = useState("");
  const normalizedSearch = search.trim().toLowerCase();
  const filtered = projects.filter((project) =>
    [project.name, project.description ?? "", project.branch].some((value) => value.toLowerCase().includes(normalizedSearch)),
  );

  return (
    <main className="flex flex-col gap-6 p-5 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1"><PageHeader title="Projekte" description="Anwendungen, Deployments und ihre aktuelle Arbeitsversion." /></div>
        <Button asChild size="lg"><Link href={`/${orgSlug}/projects/new`}><Plus data-icon="inline-start" />Projekt erstellen</Link></Button>
      </div>

      {isError ? <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-100"><span>Projekte konnten nicht geladen werden. Prüfe die Verbindung und versuche es erneut.</span><Button size="sm" variant="outline" onClick={() => void refetch()}>Erneut laden</Button></div> : null}

      <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#172128]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] px-5 py-4">
          <label className="relative min-w-[14rem] max-w-md flex-1"><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" /><span className="sr-only">Projekte suchen</span><input type="search" name="projectSearch" autoComplete="off" placeholder="Projekte suchen …" value={search} onChange={(event) => setSearch(event.target.value)} className="h-10 w-full rounded-xl border border-white/[0.08] bg-white/[0.035] pl-10 pr-3 text-sm text-zinc-200 placeholder:text-zinc-600 outline-none focus-visible:border-[#00cec9]/50 focus-visible:ring-4 focus-visible:ring-[#00cec9]/10" /></label>
          <p aria-live="polite" className="text-sm text-zinc-500">{isLoading ? "Lade Projekte …" : `${filtered.length} ${filtered.length === 1 ? "Projekt" : "Projekte"}`}</p>
        </div>

        {isLoading ? <div aria-busy="true" className="divide-y divide-white/[0.06] px-5 py-2">{[1, 2, 3, 4].map((item) => <div key={item} className="h-16 border-b border-white/[0.06] last:border-0" />)}</div> : null}
        {!isLoading && !isError && filtered.length > 0 ? <>
          <div className="hidden overflow-x-auto md:block"><table className="w-full text-left text-sm"><thead className="border-b border-white/[0.08] text-xs uppercase tracking-wide text-zinc-500"><tr><th className="px-5 py-3 font-medium">Projekt</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Branch</th><th className="px-5 py-3 text-right font-medium">Letzte Änderung</th></tr></thead><tbody className="divide-y divide-white/[0.06]">{filtered.map((project) => <tr key={project.id} className="hover:bg-white/[0.025]"><td className="px-5 py-4"><Link href={`/${orgSlug}/projects/${project.id}`} className="flex min-w-0 items-center gap-3 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#81ecec]"><FolderGit2 className="size-4 shrink-0 text-[#81ecec]" /><span className="min-w-0"><span className="block truncate font-medium text-zinc-100">{project.name}</span><span className="mt-0.5 block truncate text-xs text-zinc-500">{project.description || "Keine Beschreibung"}</span></span></Link></td><td className="px-4 py-4"><ResourceStatusBadge status={project.status} /></td><td className="px-4 py-4"><span className="inline-flex max-w-44 items-center gap-1.5 font-mono text-xs text-zinc-400"><GitBranch className="size-3 shrink-0" /><span className="truncate">{project.branch}</span></span></td><td className="px-5 py-4 text-right text-xs text-zinc-500">{formatDate(project.updatedAt)}</td></tr>)}</tbody></table></div>
          <div className="divide-y divide-white/[0.06] md:hidden">{filtered.map((project) => <Link key={project.id} href={`/${orgSlug}/projects/${project.id}`} className="flex items-center gap-3 px-4 py-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#81ecec]"><FolderGit2 className="size-4 shrink-0 text-[#81ecec]" /><span className="min-w-0 flex-1"><span className="block truncate font-medium text-zinc-100">{project.name}</span><span className="mt-1 flex min-w-0 items-center gap-1.5 font-mono text-xs text-zinc-500"><GitBranch className="size-3 shrink-0" /><span className="truncate">{project.branch}</span></span></span><ResourceStatusBadge status={project.status} /><ArrowRight className="size-4 shrink-0 text-zinc-600" /></Link>)}</div>
        </> : null}
        {!isLoading && !isError && filtered.length === 0 ? <DesignEmptyState icon={FolderGit2} title={normalizedSearch ? "Keine passenden Projekte" : "Noch keine Projekte"} description={normalizedSearch ? "Passe den Suchbegriff an oder entferne ihn, um alle Projekte zu sehen." : "Erstelle ein Projekt, um Anwendungen und Deployments zu verwalten."} detail={normalizedSearch ? "Suche durchsucht Projektname, Beschreibung und Branch." : "Ein Projekt bündelt Anwendungen, Deployments und Umgebungen."} action={normalizedSearch ? undefined : { label: "Projekt erstellen", href: `/${orgSlug}/projects/new` }} /> : null}
      </section>
    </main>
  );
}
