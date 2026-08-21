"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppWindow, Box, GitBranch, Pencil, Play, Plus, Search, Square, Trash2 } from "lucide-react";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { CapabilityNotice } from "@/components/layout/capability-notice";
import { PageHeader } from "@/components/layout/page-header";
import { ResourceStatusBadge } from "@/components/resources/resource-status-badge";
import { Button } from "@/components/ui/button";

type Project = { id: string; name: string };
type Application = {
  id: string; name: string; slug: string; description: string | null; sourceType: "git" | "docker";
  gitUrl: string | null; imageName: string | null; status: string; branch: string; projectId: string; projectName: string; updatedAt: string;
};
type SourceType = "git" | "docker";
const api = (path: string) => `${process.env.NEXT_PUBLIC_API_URL ?? ""}${path}`;

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64);
}

export default function ApplicationsPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const client = useQueryClient();
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [projectId, setProjectId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sourceType, setSourceType] = useState<SourceType>("git");
  const [gitUrl, setGitUrl] = useState("");
  const [imageName, setImageName] = useState("");
  const [branch, setBranch] = useState("main");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editBranch, setEditBranch] = useState("main");

  const projects = useQuery<Project[]>({ queryKey: ["org", orgSlug, "projects"], queryFn: async () => { const response = await fetch(api(`/organizations/${orgSlug}/projects`), { credentials: "include" }); if (!response.ok) throw new Error("Projekte konnten nicht geladen werden"); return response.json(); } });
  const applications = useQuery<Application[]>({ queryKey: ["org", orgSlug, "applications"], queryFn: async () => { const response = await fetch(api(`/organizations/${orgSlug}/applications`), { credentials: "include" }); if (!response.ok) throw new Error("Anwendungen konnten nicht geladen werden"); return response.json(); } });
  const refresh = () => void client.invalidateQueries({ queryKey: ["org", orgSlug, "applications"] });
  const create = useMutation({
    mutationFn: async () => {
      const response = await fetch(api(`/organizations/${orgSlug}/projects/${projectId}/applications`), { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, slug: slugify(name), description: description || undefined, sourceType, gitUrl: sourceType === "git" ? gitUrl : undefined, imageName: sourceType === "docker" ? imageName : undefined, branch }) });
      if (!response.ok) { const body = await response.json().catch(() => null); throw new Error(body?.error ?? "Anwendung konnte nicht erstellt werden"); }
    },
    onSuccess: () => { setCreating(false); setName(""); setDescription(""); setGitUrl(""); setImageName(""); refresh(); },
  });
  const remove = useMutation({ mutationFn: async (app: Application) => { const response = await fetch(api(`/organizations/${orgSlug}/projects/${app.projectId}/applications/${app.id}`), { method: "DELETE", credentials: "include" }); if (!response.ok) throw new Error("Anwendung konnte nicht gelöscht werden"); }, onSuccess: refresh });
  const runtimeAction = useMutation({ mutationFn: async ({ app, action }: { app: Application; action: "deploy" | "stop" }) => { const response = await fetch(api(`/organizations/${orgSlug}/projects/${app.projectId}/applications/${app.id}/${action}`), { method: "POST", credentials: "include" }); if (!response.ok) { const body = await response.json().catch(() => null); throw new Error(body?.error ?? "Runtime-Aktion fehlgeschlagen"); } }, onSuccess: refresh });
  const update = useMutation({ mutationFn: async (app: Application) => { const response = await fetch(api(`/organizations/${orgSlug}/projects/${app.projectId}/applications/${app.id}`), { method: "PATCH", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: editName, description: editDescription || null, branch: editBranch }) }); if (!response.ok) { const body = await response.json().catch(() => null); throw new Error(body?.error ?? "Anwendung konnte nicht gespeichert werden"); } }, onSuccess: () => { setEditingId(null); refresh(); } });
  const visible = useMemo(() => (applications.data ?? []).filter((item) => `${item.name} ${item.projectName} ${item.description ?? ""}`.toLowerCase().includes(search.toLowerCase())), [applications.data, search]);
  const canSubmit = Boolean(projectId && name && (sourceType === "git" ? gitUrl : imageName));

  return <div className="space-y-6 p-5 sm:p-7">
    <div className="flex flex-wrap items-start justify-between gap-4"><PageHeader title="Anwendungen" description="Eigenständige Workloads innerhalb deiner Projekte." /><Button onClick={() => setCreating((value) => !value)} className="gap-2"><Plus className="size-3.5" />Anwendung hinzufügen</Button></div>
    {creating ? <section className="space-y-4 rounded-2xl border border-[#0984e3]/25 bg-[#172128] p-5"><div><h2 className="font-medium text-zinc-100">Neue Anwendung</h2><p className="mt-1 text-sm text-zinc-500">Die Konfiguration wird gespeichert. Der eigentliche Rollout wird erst mit dem Deployment-Service verfügbar.</p></div><div className="grid gap-4 md:grid-cols-2"><label className="text-sm text-zinc-300">Projekt<select value={projectId} onChange={(event) => setProjectId(event.target.value)} className="mt-1.5 h-10 w-full rounded-xl border border-white/[0.1] bg-[#0b1217] px-3 text-zinc-100"><option value="">Projekt auswählen</option>{(projects.data ?? []).map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label><label className="text-sm text-zinc-300">Name<input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} placeholder="api-service" className="mt-1.5 h-10 w-full rounded-xl border border-white/[0.1] bg-[#0b1217] px-3 text-zinc-100" /></label><label className="text-sm text-zinc-300">Quelle<select value={sourceType} onChange={(event) => setSourceType(event.target.value as SourceType)} className="mt-1.5 h-10 w-full rounded-xl border border-white/[0.1] bg-[#0b1217] px-3 text-zinc-100"><option value="git">Git-Repository</option><option value="docker">Docker-Image</option></select></label><label className="text-sm text-zinc-300">{sourceType === "git" ? "Repository-URL" : "Image-Name"}<input value={sourceType === "git" ? gitUrl : imageName} onChange={(event) => sourceType === "git" ? setGitUrl(event.target.value) : setImageName(event.target.value)} placeholder={sourceType === "git" ? "https://github.com/org/repo" : "ghcr.io/org/image:latest"} className="mt-1.5 h-10 w-full rounded-xl border border-white/[0.1] bg-[#0b1217] px-3 text-zinc-100" /></label><label className="text-sm text-zinc-300">Branch{sourceType === "docker" ? " (wird später verwendet)" : ""}<input value={branch} onChange={(event) => setBranch(event.target.value)} maxLength={255} className="mt-1.5 h-10 w-full rounded-xl border border-white/[0.1] bg-[#0b1217] px-3 text-zinc-100" /></label><label className="text-sm text-zinc-300">Beschreibung<input value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} className="mt-1.5 h-10 w-full rounded-xl border border-white/[0.1] bg-[#0b1217] px-3 text-zinc-100" /></label></div>{create.error ? <p className="text-sm text-red-300">{create.error.message}</p> : null}<div className="flex gap-2"><Button onClick={() => create.mutate()} disabled={!canSubmit || create.isPending}>{create.isPending ? "Wird gespeichert …" : "Anwendung speichern"}</Button><Button variant="ghost" onClick={() => setCreating(false)}>Abbrechen</Button></div></section> : null}
    <CapabilityNotice title="Docker-Runtime verfügbar" description="Docker-Image-Anwendungen können im isolierten Devion-Netzwerk gestartet und gestoppt werden. Git-Anwendungen benötigen weiterhin den Build-Worker." />
    <div className="relative max-w-md"><Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-zinc-500" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Anwendungen suchen …" className="h-9 w-full rounded-xl border border-white/[0.08] bg-white/[0.035] pl-9 pr-3 text-sm text-zinc-200" /></div>
    {applications.isError ? <div className="rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-100">Anwendungen konnten nicht geladen werden. <button type="button" className="underline" onClick={() => applications.refetch()}>Erneut versuchen</button></div> : null}
    {applications.isLoading ? <div className="grid gap-3 lg:grid-cols-2">{[1, 2].map((item) => <div key={item} className="h-36 animate-pulse rounded-2xl bg-[#172128]" />)}</div> : null}
    {!applications.isLoading && !applications.isError && visible.length === 0 ? <div className="flex flex-col items-center rounded-2xl border border-dashed border-white/[0.1] bg-[#172128]/50 py-16 text-center"><AppWindow className="size-8 text-zinc-600" /><p className="mt-3 text-sm font-medium text-zinc-300">Keine Anwendungen gefunden</p><p className="mt-1 text-xs text-zinc-600">Lege einen separaten Workload in einem Projekt an.</p></div> : null}
    <div className="grid gap-3 lg:grid-cols-2">{visible.map((application) => <section key={application.id} className="rounded-2xl border border-white/[0.07] bg-[#172128] p-5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs text-[#81ecec]">{application.projectName}</p><h2 className="mt-1 truncate font-medium text-zinc-100">{application.name}</h2><p className="mt-1 text-xs text-zinc-500">{application.description ?? "Keine Beschreibung"}</p></div><ResourceStatusBadge status={application.status === "draft" ? "idle" : application.status} /></div>{editingId === application.id ? <div className="mt-4 grid gap-3 border-t border-white/[0.06] pt-4"><input aria-label="Anwendungsname" value={editName} onChange={(event) => setEditName(event.target.value)} className="h-9 rounded-xl border border-white/[0.1] bg-[#0b1217] px-3 text-sm text-zinc-100" /><input aria-label="Beschreibung" value={editDescription} onChange={(event) => setEditDescription(event.target.value)} placeholder="Beschreibung" className="h-9 rounded-xl border border-white/[0.1] bg-[#0b1217] px-3 text-sm text-zinc-100" /><input aria-label="Branch" value={editBranch} onChange={(event) => setEditBranch(event.target.value)} placeholder="Branch" className="h-9 rounded-xl border border-white/[0.1] bg-[#0b1217] px-3 text-sm text-zinc-100" />{update.error ? <p className="text-xs text-red-300">{update.error.message}</p> : null}<div className="flex gap-2"><Button size="sm" onClick={() => update.mutate(application)} disabled={!editName || !editBranch || update.isPending}>{update.isPending ? "Speichert …" : "Speichern"}</Button><Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Abbrechen</Button></div></div> : <div className="mt-4 flex items-center gap-3 text-xs text-zinc-500"><span className="inline-flex items-center gap-1"><Box className="size-3" />{application.sourceType === "git" ? "Git" : "Docker"}</span><span className="inline-flex items-center gap-1"><GitBranch className="size-3" />{application.branch}</span>{application.sourceType === "docker" ? application.status === "healthy" ? <button type="button" onClick={() => runtimeAction.mutate({ app: application, action: "stop" })} disabled={runtimeAction.isPending} className="inline-flex items-center gap-1 text-zinc-500 hover:text-amber-300"><Square className="size-3" />Stoppen</button> : <button type="button" onClick={() => runtimeAction.mutate({ app: application, action: "deploy" })} disabled={runtimeAction.isPending} className="inline-flex items-center gap-1 text-zinc-500 hover:text-emerald-300"><Play className="size-3" />Starten</button> : null}<button type="button" onClick={() => { setEditingId(application.id); setEditName(application.name); setEditDescription(application.description ?? ""); setEditBranch(application.branch); }} className="ml-auto inline-flex items-center gap-1 text-zinc-500 transition hover:text-[#81ecec]"><Pencil className="size-3" />Bearbeiten</button><button type="button" onClick={() => { if (confirm(`Anwendung ${application.name} löschen?`)) remove.mutate(application); }} disabled={remove.isPending} className="inline-flex items-center gap-1 text-zinc-500 transition hover:text-red-300"><Trash2 className="size-3" />Löschen</button></div>}</section>)}</div>
  </div>;
}
