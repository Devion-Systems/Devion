"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  applicationCount: number;
  environmentCount: number;
  domainCount: number;
  accessMode: "organization" | "team";
  teamIds: string[];
  updatedAt: string;
};
type ProjectPage = { items: Project[]; page: number; limit: number; total: number };
type Team = { id: string; name: string };
type OrganizationContext = { permissions: string[] };

const api = (path: string) => `${process.env.NEXT_PUBLIC_API_URL ?? ""}${path}`;

function useProjects(orgSlug: string, filters: { search: string; status: string; teamId: string; sort: string; page: number }) {
  return useQuery<ProjectPage>({
    queryKey: ["orgs", orgSlug, "projects", filters],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(filters.page), limit: "25", sort: filters.sort });
      if (filters.search.trim()) params.set("search", filters.search.trim());
      if (filters.status) params.set("status", filters.status);
      if (filters.teamId) params.set("teamId", filters.teamId);
      const response = await fetch(api(`/organizations/${orgSlug}/projects?${params}`), { credentials: "include" });
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
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [teamId, setTeamId] = useState("");
  const [sort, setSort] = useState("updated");
  const [page, setPage] = useState(1);
  const client = useQueryClient();
  const { data, isLoading, isError, refetch } = useProjects(orgSlug, { search, status, teamId, sort, page });
  const projects = data?.items ?? [];
  const context = useQuery<OrganizationContext>({ queryKey: ["orgs", orgSlug, "context"], queryFn: async () => { const response = await fetch(api(`/organizations/${orgSlug}`), { credentials: "include" }); if (!response.ok) throw new Error("Organisation konnte nicht geladen werden"); return response.json(); } });
  const teams = useQuery<Team[]>({ queryKey: ["orgs", orgSlug, "teams"], queryFn: async () => { const response = await fetch(api(`/organizations/${orgSlug}/teams`), { credentials: "include" }); if (!response.ok) throw new Error("Teams konnten nicht geladen werden"); return response.json(); } });
  const lifecycle = useMutation({ mutationFn: async ({ id, action }: { id: string; action: "archive" | "restore" }) => { const response = await fetch(api(`/organizations/${orgSlug}/projects/${id}/${action}`), { method: "POST", credentials: "include" }); if (!response.ok) throw new Error("Projektstatus konnte nicht geändert werden"); }, onSuccess: () => void client.invalidateQueries({ queryKey: ["orgs", orgSlug, "projects"] }) });

  return (
    <main className="flex flex-col gap-6 py-6">
      <PageHeader
        title="Projects"
        description="Manage applications and infrastructure grouped by project."
        primaryAction={context.data?.permissions.includes("projects.create") ? (
          <Button asChild size="lg">
            <Link href={`/${orgSlug}/projects/new`}>
              <Plus data-icon="inline-start" />New Project
            </Link>
          </Button>
        ) : undefined}
      />

      {isError ? <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-100"><span>Projekte konnten nicht geladen werden. Prüfe die Verbindung und versuche es erneut.</span><Button size="sm" variant="outline" onClick={() => void refetch()}>Erneut laden</Button></div> : null}

      <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#172128]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] px-5 py-4">
          <label className="relative min-w-[14rem] max-w-md flex-1"><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" /><span className="sr-only">Projekte suchen</span><input type="search" name="projectSearch" autoComplete="off" placeholder="Projekte suchen …" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} className="h-10 w-full rounded-xl border border-white/[0.08] bg-white/[0.035] pl-10 pr-3 text-sm text-zinc-200 placeholder:text-zinc-600 outline-none focus-visible:border-[#00cec9]/50 focus-visible:ring-4 focus-visible:ring-[#00cec9]/10" /></label>
          <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className="h-10 rounded-xl border border-white/[0.08] bg-white/[0.035] px-3 text-sm text-zinc-300"><option value="">Alle Status</option><option value="active">Aktiv</option><option value="archived">Archiviert</option></select>
          <select value={teamId} onChange={(event) => { setTeamId(event.target.value); setPage(1); }} className="h-10 rounded-xl border border-white/[0.08] bg-white/[0.035] px-3 text-sm text-zinc-300"><option value="">Alle Teams</option>{(teams.data ?? []).map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select>
          <select value={sort} onChange={(event) => setSort(event.target.value)} className="h-10 rounded-xl border border-white/[0.08] bg-white/[0.035] px-3 text-sm text-zinc-300"><option value="updated">Zuletzt geändert</option><option value="created">Erstellt</option><option value="name">Name</option></select>
          <p aria-live="polite" className="text-sm text-zinc-500">{isLoading ? "Lade Projekte …" : `${data?.total ?? projects.length} ${(data?.total ?? projects.length) === 1 ? "Projekt" : "Projekte"}`}</p>
        </div>

        {isLoading ? <div aria-busy="true" className="divide-y divide-white/[0.06] px-5 py-2">{[1, 2, 3, 4].map((item) => <div key={item} className="h-16 border-b border-white/[0.06] last:border-0" />)}</div> : null}
        {!isLoading && !isError && projects.length > 0 ? <>
          <div className="hidden overflow-x-auto md:block"><table className="w-full text-left text-sm"><thead className="border-b border-white/[0.08] text-xs uppercase tracking-wide text-zinc-500"><tr><th className="px-5 py-3 font-medium">Projekt</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Ressourcen</th><th className="px-4 py-3 font-medium">Zugriff</th><th className="px-4 py-3 font-medium">Branch</th><th className="px-5 py-3 text-right font-medium">Letzte Änderung</th><th className="px-5 py-3 text-right font-medium">Aktionen</th></tr></thead><tbody className="divide-y divide-white/[0.06]">{projects.map((project) => <tr key={project.id} className="hover:bg-white/[0.025]"><td className="px-5 py-4"><Link href={`/${orgSlug}/projects/${project.id}`} className="flex min-w-0 items-center gap-3 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#81ecec]"><FolderGit2 className="size-4 shrink-0 text-[#81ecec]" /><span className="min-w-0"><span className="block truncate font-medium text-zinc-100">{project.name}</span><span className="mt-0.5 block truncate text-xs text-zinc-500">{project.description || "Keine Beschreibung"}</span></span></Link></td><td className="px-4 py-4"><ResourceStatusBadge status={project.status} /></td><td className="px-4 py-4 text-xs text-zinc-400">{project.applicationCount} Apps · {project.environmentCount} Envs · {project.domainCount} Domains</td><td className="px-4 py-4 text-xs text-zinc-400">{project.accessMode === "organization" ? "Organisation" : `${project.teamIds.length} Team${project.teamIds.length === 1 ? "" : "s"}`}</td><td className="px-4 py-4"><span className="inline-flex max-w-44 items-center gap-1.5 font-mono text-xs text-zinc-400"><GitBranch className="size-3 shrink-0" /><span className="truncate">{project.branch}</span></span></td><td className="px-5 py-4 text-right text-xs text-zinc-500">{formatDate(project.updatedAt)}</td><td className="px-5 py-4 text-right">{context.data?.permissions.includes("projects.archive") ? <Button size="sm" variant="ghost" disabled={lifecycle.isPending} onClick={() => lifecycle.mutate({ id: project.id, action: project.status === "archived" ? "restore" : "archive" })}>{project.status === "archived" ? "Restore" : "Archive"}</Button> : null}{context.data?.permissions.includes("projects.update") ? <Button size="sm" variant="ghost" asChild><Link href={`/${orgSlug}/projects/${project.id}/settings/general`}>Settings</Link></Button> : null}</td></tr>)}</tbody></table></div>
          <div className="divide-y divide-white/[0.06] md:hidden">{projects.map((project) => <Link key={project.id} href={`/${orgSlug}/projects/${project.id}`} className="flex items-center gap-3 px-4 py-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#81ecec]"><FolderGit2 className="size-4 shrink-0 text-[#81ecec]" /><span className="min-w-0 flex-1"><span className="block truncate font-medium text-zinc-100">{project.name}</span><span className="mt-1 flex min-w-0 items-center gap-1.5 font-mono text-xs text-zinc-500"><GitBranch className="size-3 shrink-0" /><span className="truncate">{project.branch}</span></span></span><ResourceStatusBadge status={project.status} /><ArrowRight className="size-4 shrink-0 text-zinc-600" /></Link>)}</div>
        </> : null}
        {!isLoading && !isError && projects.length === 0 ? <DesignEmptyState icon={FolderGit2} title={search || status || teamId ? "Keine passenden Projekte" : "Noch keine Projekte"} description={search || status || teamId ? "Passe Suche oder Filter an." : "Erstelle ein Projekt, um Anwendungen und Deployments zu verwalten."} detail="Ein Projekt bündelt Anwendungen, Deployments und Umgebungen." action={search || status || teamId ? undefined : { label: "Projekt erstellen", href: `/${orgSlug}/projects/new` }} /> : null}
        {!isLoading && (data?.total ?? 0) > (data?.limit ?? 25) ? <div className="flex items-center justify-end gap-2 border-t border-white/[0.08] px-5 py-3"><Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage((current) => current - 1)}>Zurück</Button><span className="text-xs text-zinc-500">Seite {page} von {Math.ceil((data?.total ?? 0) / (data?.limit ?? 25))}</span><Button size="sm" variant="outline" disabled={page * (data?.limit ?? 25) >= (data?.total ?? 0)} onClick={() => setPage((current) => current + 1)}>Weiter</Button></div> : null}
      </section>
    </main>
  );
}
