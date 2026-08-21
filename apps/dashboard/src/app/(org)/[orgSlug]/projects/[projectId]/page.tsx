"use client";

import { useQuery } from "@tanstack/react-query";
import { GitBranch, GitFork, Link2, Rocket } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { CapabilityNotice } from "@/components/layout/capability-notice";
import { PageHeader } from "@/components/layout/page-header";
import { ResourceStatusBadge } from "@/components/resources/resource-status-badge";
import { Button } from "@/components/ui/button";

type Project = { id: string; name: string; slug: string; description: string | null; sourceType: "git" | "docker" | "blank"; gitUrl: string | null; branch: string; status: string; routingTargetUrl: string | null; createdAt: string; updatedAt: string };

function useProject(orgSlug: string, projectId: string) {
  return useQuery<Project>({
    queryKey: ["orgs", orgSlug, "projects", projectId],
    queryFn: async () => {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? ""}/organizations/${orgSlug}/projects/${projectId}`, { credentials: "include" });
      if (!response.ok) throw new Error("Projekt konnte nicht geladen werden");
      return response.json();
    },
  });
}

function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unbekannt" : new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default function ProjectDetailPage() {
  const { orgSlug, projectId } = useParams<{ orgSlug: string; projectId: string }>();
  const router = useRouter();
  const { data: project, isLoading, isError, refetch } = useProject(orgSlug, projectId);

  if (isLoading) return <div className="space-y-4 p-6">{[1, 2, 3].map((item) => <div key={item} className="h-24 animate-pulse rounded-2xl border border-white/[0.06] bg-[#1e272e]" />)}</div>;
  if (isError || !project) return <div className="p-6"><div className="rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-100">Projekt konnte nicht geladen werden. <button type="button" onClick={() => refetch()} className="ml-2 underline underline-offset-2">Erneut versuchen</button></div></div>;

  return <div className="space-y-6 p-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><PageHeader title={project.name} description={project.description ?? "Dieses Projekt ist bereit zur Konfiguration."} /><ResourceStatusBadge status={project.status} /></div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <section className="rounded-xl border border-white/[0.06] bg-[#1e272e] p-4"><p className="text-xs text-zinc-500">Quelle</p><p className="mt-1.5 capitalize text-sm font-medium text-zinc-200">{project.sourceType}</p></section>
      <section className="rounded-xl border border-white/[0.06] bg-[#1e272e] p-4"><p className="text-xs text-zinc-500">Branch</p><p className="mt-1.5 flex items-center gap-1.5 text-sm font-medium text-zinc-200"><GitBranch className="size-3.5 text-[#81ecec]" />{project.branch}</p></section>
      <section className="rounded-xl border border-white/[0.06] bg-[#1e272e] p-4"><p className="text-xs text-zinc-500">Projektkennung</p><p className="mt-1.5 font-mono text-sm text-zinc-200">{project.slug}</p></section>
      <section className="rounded-xl border border-white/[0.06] bg-[#1e272e] p-4"><p className="text-xs text-zinc-500">Zuletzt geändert</p><p className="mt-1.5 text-sm font-medium text-zinc-200">{dateLabel(project.updatedAt)}</p></section>
    </div>
    {project.gitUrl ? <section className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-[#1e272e] p-4 text-sm text-zinc-300"><GitFork className="size-4 text-[#81ecec]" /><span className="min-w-0 flex-1 truncate font-mono text-xs">{project.gitUrl}</span><a href={project.gitUrl} target="_blank" rel="noopener noreferrer" className="text-[#81ecec] hover:underline">Repository öffnen</a></section> : null}
    {project.routingTargetUrl ? <section className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-[#1e272e] p-4 text-sm text-zinc-300"><Link2 className="size-4 text-[#81ecec]" /><span className="min-w-0 flex-1 truncate">{project.routingTargetUrl}</span></section> : null}
    <CapabilityNotice title="Deployment-Runtime wird vorbereitet" description="Deployments, Laufzeitstatus und Rollbacks werden erst aktiviert, wenn die Control Plane einen verbundenen Deployment-Service meldet. Dieses Projekt zeigt aktuell ausschließlich gespeicherte Konfigurationsdaten." />
    <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => router.push(`/${orgSlug}/projects/${projectId}/domains`)}>Domains verwalten</Button><Button variant="outline" onClick={() => router.push(`/${orgSlug}/projects/${projectId}/environments`)}>Umgebungen verwalten</Button><Button variant="outline" onClick={() => router.push(`/${orgSlug}/projects/${projectId}/settings/general`)}>Projekt bearbeiten</Button><Button disabled className="gap-2"><Rocket className="size-3.5" />Deployment geplant</Button></div>
  </div>;
}
