"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderKanban, Plus, X } from "lucide-react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { ResourceStatusBadge } from "@/components/resources/resource-status-badge";
import { Button } from "@/components/ui/button";

type Project = { id: string; name: string; slug: string; status: string; teamId?: string | null };
type Team = { id: string; name: string; projects: Project[] };
const api = (path: string) => `${process.env.NEXT_PUBLIC_API_URL ?? ""}${path}`;

export default function TeamProjectsPage() {
  const { orgSlug, teamSlug } = useParams<{ orgSlug: string; teamSlug: string }>(); const client = useQueryClient();
  const team = useQuery<Team>({ queryKey: ["org", orgSlug, "team", teamSlug], queryFn: async () => { const r = await fetch(api(`/organizations/${orgSlug}/teams/${teamSlug}`), { credentials: "include" }); if (!r.ok) throw new Error("Team konnte nicht geladen werden"); return r.json(); } });
  const projects = useQuery<Project[]>({ queryKey: ["orgs", orgSlug, "projects"], queryFn: async () => { const r = await fetch(api(`/organizations/${orgSlug}/projects`), { credentials: "include" }); if (!r.ok) throw new Error("Projekte konnten nicht geladen werden"); return r.json(); } });
  const refresh = () => { void client.invalidateQueries({ queryKey: ["org", orgSlug, "team", teamSlug] }); void client.invalidateQueries({ queryKey: ["orgs", orgSlug, "projects"] }); };
  const assign = useMutation({ mutationFn: async (projectId: string) => { const r = await fetch(api(`/organizations/${orgSlug}/teams/${teamSlug}/projects/${projectId}`), { method: "PUT", credentials: "include" }); if (!r.ok) throw new Error("Projekt konnte nicht zugewiesen werden"); }, onSuccess: refresh });
  const unassign = useMutation({ mutationFn: async (projectId: string) => { const r = await fetch(api(`/organizations/${orgSlug}/teams/${teamSlug}/projects/${projectId}`), { method: "DELETE", credentials: "include" }); if (!r.ok) throw new Error("Projekt konnte nicht entfernt werden"); }, onSuccess: refresh });
  const assigned = team.data?.projects ?? []; const available = (projects.data ?? []).filter((project) => project.teamId !== team.data?.id);
  return <div className="space-y-6 p-6"><PageHeader title="Team-Projekte" description="Projekte bleiben Eigentum der Organisation und können einem Team für die Zusammenarbeit zugeordnet werden." /><div className="grid gap-4 lg:grid-cols-2"><section className="rounded-2xl border border-white/[0.07] bg-[#172128] p-5"><h2 className="flex items-center gap-2 font-semibold text-zinc-100"><FolderKanban className="size-4 text-[#81ecec]" /> Zugewiesene Projekte</h2><div className="mt-4 space-y-3">{assigned.map((project) => <div key={project.id} className="flex items-center gap-3"><div className="min-w-0 flex-1"><p className="truncate text-sm text-zinc-200">{project.name}</p><p className="text-xs text-zinc-500">{project.slug}</p></div><ResourceStatusBadge status={project.status} /><Button size="sm" variant="ghost" onClick={() => unassign.mutate(project.id)} disabled={unassign.isPending}><X className="size-4" /> Entfernen</Button></div>)}{!team.isLoading && !assigned.length ? <p className="text-sm text-zinc-500">Keine Projekte zugewiesen.</p> : null}</div></section><section className="rounded-2xl border border-white/[0.07] bg-[#172128] p-5"><h2 className="flex items-center gap-2 font-semibold text-zinc-100"><Plus className="size-4 text-[#81ecec]" /> Projekt zuweisen</h2><div className="mt-4 space-y-3">{available.map((project) => <div key={project.id} className="flex items-center gap-3"><div className="min-w-0 flex-1"><p className="truncate text-sm text-zinc-200">{project.name}</p><p className="text-xs text-zinc-500">{project.slug}</p></div><Button size="sm" variant="outline" onClick={() => assign.mutate(project.id)} disabled={assign.isPending}>Zuweisen</Button></div>)}{!projects.isLoading && !available.length ? <p className="text-sm text-zinc-500">Keine weiteren Projekte verfügbar.</p> : null}</div></section></div></div>;
}
