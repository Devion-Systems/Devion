"use client";

import { useQuery } from "@tanstack/react-query";
import { FolderGit2, GitBranch, Plus, Search } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { ResourceStatusBadge } from "@/components/resources/resource-status-badge";
import { Button } from "@/components/ui/button";

type Project = { id: string; name: string; description: string | null; status: string; branch: string; updatedAt: string };

function useProjects(orgSlug: string) {
  return useQuery<Project[]>({
    queryKey: ["orgs", orgSlug, "projects"],
    queryFn: async () => {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? ""}/organizations/${orgSlug}/projects`, { credentials: "include" });
      if (!response.ok) throw new Error("Projekte konnten nicht geladen werden");
      return response.json();
    },
  });
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unbekannt" : new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(date);
}

export default function ProjectsPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const router = useRouter();
  const { data: projects = [], isLoading, isError, refetch } = useProjects(orgSlug);
  const [search, setSearch] = useState("");
  const filtered = projects.filter((project) => project.name.toLowerCase().includes(search.toLowerCase()) || project.description?.toLowerCase().includes(search.toLowerCase()));

  return <div className="space-y-6 p-5 sm:p-7">
    <PageHeader title="Projekte" description={`${projects.length} Projekte in dieser Organisation`} />
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative min-w-[14rem] max-w-sm flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-zinc-500" /><input type="search" placeholder="Projekte suchen …" value={search} onChange={(event) => setSearch(event.target.value)} className="h-9 w-full rounded-xl border border-white/[0.08] bg-white/[0.035] pl-9 pr-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-[#00cec9]/50 focus:outline-none focus:ring-4 focus:ring-[#00cec9]/10" /></div>
      <Button onClick={() => router.push(`/${orgSlug}/projects/new`)} className="gap-2"><Plus className="size-3.5" /> Neues Projekt</Button>
    </div>
    {isError ? <div className="rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-100">Projekte konnten nicht geladen werden. <button type="button" onClick={() => refetch()} className="ml-2 underline underline-offset-2">Erneut versuchen</button></div> : null}
    {isLoading ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{[1, 2, 3].map((key) => <div key={key} className="h-36 animate-pulse rounded-2xl border border-white/[0.06] bg-[#172128]" />)}</div> : null}
    {!isLoading && !isError && filtered.length === 0 ? <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/[0.1] bg-[#172128]/50 py-20 text-center"><FolderGit2 className="size-8 text-zinc-600" /><div><p className="text-sm font-medium text-zinc-300">Keine Projekte gefunden</p><p className="mt-1 text-xs text-zinc-600">{search ? "Andere Suchbegriffe versuchen" : "Erstelle dein erstes Projekt"}</p></div>{!search ? <Button variant="outline" size="sm" onClick={() => router.push(`/${orgSlug}/projects/new`)}>Projekt erstellen</Button> : null}</div> : null}
    {!isLoading && !isError && filtered.length > 0 ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{filtered.map((project) => <button key={project.id} type="button" onClick={() => router.push(`/${orgSlug}/projects/${project.id}`)} className="group rounded-2xl border border-white/[0.07] bg-[#172128]/90 p-5 text-left shadow-[0_12px_32px_rgba(0,0,0,.1)] transition hover:-translate-y-0.5 hover:border-[#0984e3]/35"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="truncate font-medium text-zinc-100">{project.name}</h2>{project.description ? <p className="mt-1 line-clamp-2 text-xs text-zinc-500">{project.description}</p> : null}</div><ResourceStatusBadge status={project.status} /></div><div className="mt-4 flex items-center gap-1.5 text-xs text-zinc-500"><GitBranch className="size-3" /><span className="font-mono">{project.branch}</span><span className="text-zinc-700">·</span><span>Aktualisiert {formatDate(project.updatedAt)}</span></div></button>)}</div> : null}
  </div>;
}
