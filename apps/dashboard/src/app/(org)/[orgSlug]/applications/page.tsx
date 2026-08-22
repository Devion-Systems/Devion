"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AppWindow,
  ArrowRight,
  Box,
  GitBranch,
  Pencil,
  Play,
  Plus,
  Search,
  Square,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { CapabilityNotice } from "@/components/layout/capability-notice";
import { DesignEmptyState } from "@/components/layout/design-empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { ResourceStatusBadge } from "@/components/resources/resource-status-badge";
import { Button } from "@/components/ui/button";

type Project = { id: string; name: string };
type SourceType = "git" | "docker";
type Application = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sourceType: SourceType;
  gitUrl: string | null;
  imageName: string | null;
  status: string;
  branch: string;
  projectId: string;
  projectName: string;
  updatedAt: string;
};

const api = (path: string) => `${process.env.NEXT_PUBLIC_API_URL ?? ""}${path}`;
const dateTime = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" });
const inputClassName = "mt-1.5 h-10 w-full rounded-xl border border-white/[0.1] bg-[#0b1217] px-3 text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-[#81ecec]/70 focus:ring-2 focus:ring-[#81ecec]/20";

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64);
}

function sourceLabel(application: Application) {
  return application.sourceType === "git" ? application.gitUrl ?? "Git-Repository" : application.imageName ?? "Docker-Image";
}

function isActive(application: Application) {
  return application.status === "healthy" || application.status === "deploying";
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

  const projects = useQuery<Project[]>({
    queryKey: ["org", orgSlug, "projects"],
    queryFn: async () => {
      const response = await fetch(api(`/organizations/${orgSlug}/projects`), { credentials: "include" });
      if (!response.ok) throw new Error("Projekte konnten nicht geladen werden");
      return response.json();
    },
  });
  const applications = useQuery<Application[]>({
    queryKey: ["org", orgSlug, "applications"],
    queryFn: async () => {
      const response = await fetch(api(`/organizations/${orgSlug}/applications`), { credentials: "include" });
      if (!response.ok) throw new Error("Anwendungen konnten nicht geladen werden");
      return response.json();
    },
  });
  const refresh = () => void client.invalidateQueries({ queryKey: ["org", orgSlug, "applications"] });
  const resetCreateForm = () => {
    setProjectId("");
    setName("");
    setDescription("");
    setGitUrl("");
    setImageName("");
    setBranch("main");
    setSourceType("git");
  };

  const create = useMutation({
    mutationFn: async () => {
      const response = await fetch(api(`/organizations/${orgSlug}/projects/${projectId}/applications`), {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          slug: slugify(name),
          description: description || undefined,
          sourceType,
          gitUrl: sourceType === "git" ? gitUrl : undefined,
          imageName: sourceType === "docker" ? imageName : undefined,
          branch,
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "Anwendung konnte nicht erstellt werden");
      }
    },
    onSuccess: () => {
      resetCreateForm();
      setCreating(false);
      refresh();
    },
  });
  const remove = useMutation({
    mutationFn: async (application: Application) => {
      const response = await fetch(api(`/organizations/${orgSlug}/projects/${application.projectId}/applications/${application.id}`), {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "Anwendung konnte nicht gelöscht werden");
      }
    },
    onSuccess: refresh,
  });
  const runtimeAction = useMutation({
    mutationFn: async ({ application, action }: { application: Application; action: "deploy" | "stop" }) => {
      const response = await fetch(api(`/organizations/${orgSlug}/projects/${application.projectId}/applications/${application.id}/${action}`), {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "Runtime-Aktion fehlgeschlagen");
      }
    },
    onSuccess: refresh,
  });
  const update = useMutation({
    mutationFn: async (application: Application) => {
      const response = await fetch(api(`/organizations/${orgSlug}/projects/${application.projectId}/applications/${application.id}`), {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: editName, description: editDescription || null, branch: editBranch }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "Anwendung konnte nicht gespeichert werden");
      }
    },
    onSuccess: () => {
      setEditingId(null);
      refresh();
    },
  });

  const visible = useMemo(
    () => (applications.data ?? []).filter((item) => `${item.name} ${item.projectName} ${item.description ?? ""} ${sourceLabel(item)}`.toLowerCase().includes(search.toLowerCase())),
    [applications.data, search],
  );
  const canSubmit = Boolean(projectId && name.trim() && branch.trim() && (sourceType === "git" ? gitUrl.trim() : imageName.trim()));
  const hasProjects = (projects.data?.length ?? 0) > 0;

  function startEditing(application: Application) {
    setEditingId(application.id);
    setEditName(application.name);
    setEditDescription(application.description ?? "");
    setEditBranch(application.branch);
  }

  function applicationActions(application: Application) {
    if (application.sourceType !== "docker") {
      return <span className="text-xs text-zinc-500">Build-Worker erforderlich</span>;
    }

    const active = isActive(application);
    return (
      <Button
        type="button"
        size="sm"
        variant={active ? "outline" : "default"}
        className="min-h-9"
        onClick={() => runtimeAction.mutate({ application, action: active ? "stop" : "deploy" })}
        disabled={runtimeAction.isPending}
      >
        {active ? <Square className="size-3.5" /> : <Play className="size-3.5" />}
        {runtimeAction.isPending ? "Wird ausgeführt …" : active ? "Stoppen" : "Starten"}
      </Button>
    );
  }

  return (
    <div className="space-y-6 p-5 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader title="Anwendungen" description="Starte, stoppe und verwalte die Workloads deiner Projekte an einem Ort." />
        <Button onClick={() => setCreating(true)} className="min-h-10" disabled={creating}>
          <Plus className="size-4" />
          Anwendung hinzufügen
        </Button>
      </div>

      {creating ? (
        <section aria-labelledby="new-application-title" className="rounded-2xl border border-[#00cec9]/25 bg-[#172128] p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="new-application-title" className="font-medium text-zinc-100">Neue Anwendung</h2>
              <p className="mt-1 text-sm text-zinc-500">Wähle das Projekt und die Quelle. Docker-Images können danach direkt gestartet werden.</p>
            </div>
            <Button type="button" variant="ghost" size="icon" className="size-10 shrink-0" onClick={() => { resetCreateForm(); setCreating(false); }} aria-label="Erstellung abbrechen">
              <X className="size-4" />
            </Button>
          </div>

          {!hasProjects && !projects.isLoading ? (
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">
              <span>Erstelle zuerst ein Projekt, dem die Anwendung zugeordnet wird.</span>
              <Button asChild size="sm" variant="outline"><Link href={`/${orgSlug}/projects/new`}>Projekt erstellen</Link></Button>
            </div>
          ) : (
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="text-sm text-zinc-300">Projekt
                <select value={projectId} onChange={(event) => setProjectId(event.target.value)} className={inputClassName} disabled={projects.isLoading}>
                  <option value="">{projects.isLoading ? "Projekte werden geladen …" : "Projekt auswählen"}</option>
                  {(projects.data ?? []).map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
                </select>
              </label>
              <label className="text-sm text-zinc-300">Name
                <input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} placeholder="api-service" className={inputClassName} autoFocus />
              </label>
              <label className="text-sm text-zinc-300">Quelle
                <select value={sourceType} onChange={(event) => setSourceType(event.target.value as SourceType)} className={inputClassName}>
                  <option value="git">Git-Repository</option>
                  <option value="docker">Docker-Image</option>
                </select>
              </label>
              <label className="text-sm text-zinc-300">{sourceType === "git" ? "Repository-URL" : "Image-Name"}
                <input value={sourceType === "git" ? gitUrl : imageName} onChange={(event) => sourceType === "git" ? setGitUrl(event.target.value) : setImageName(event.target.value)} placeholder={sourceType === "git" ? "https://github.com/org/repository" : "ghcr.io/organisation/image:latest"} className={inputClassName} />
              </label>
              <label className="text-sm text-zinc-300">Branch{sourceType === "docker" ? " (optional)" : ""}
                <input value={branch} onChange={(event) => setBranch(event.target.value)} maxLength={255} className={inputClassName} />
              </label>
              <label className="text-sm text-zinc-300">Beschreibung <span className="text-zinc-600">(optional)</span>
                <input value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} placeholder="Wofür wird diese Anwendung genutzt?" className={inputClassName} />
              </label>
            </div>
          )}
          {projects.isError ? <p role="alert" className="mt-4 text-sm text-red-300">{projects.error.message}</p> : null}
          {create.error ? <p role="alert" className="mt-4 text-sm text-red-300">{create.error.message}</p> : null}
          <div className="mt-5 flex flex-wrap gap-2">
            <Button onClick={() => create.mutate()} disabled={!canSubmit || !hasProjects || create.isPending} className="min-h-10">
              {create.isPending ? "Wird gespeichert …" : "Anwendung speichern"}
            </Button>
            <Button variant="ghost" onClick={() => { resetCreateForm(); setCreating(false); }} disabled={create.isPending} className="min-h-10">Abbrechen</Button>
          </div>
        </section>
      ) : null}

      <CapabilityNotice title="Docker-Runtime verfügbar" description="Docker-Images können im isolierten Devion-Netzwerk gestartet und gestoppt werden. Git-Anwendungen benötigen weiterhin den Build-Worker." />

      {runtimeAction.error || remove.error ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-100">
          <span>{runtimeAction.error?.message ?? remove.error?.message}</span>
          <Button size="sm" variant="outline" onClick={() => { runtimeAction.reset(); remove.reset(); }}>Hinweis schließen</Button>
        </div>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#172128]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] px-5 py-4">
          <div>
            <h2 className="font-medium text-zinc-100">Workloads</h2>
            <p className="mt-1 text-sm text-zinc-500">Status prüfen und Laufzeitaktionen direkt ausführen.</p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-zinc-500" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Workloads suchen …" className="h-10 w-full rounded-xl border border-white/[0.08] bg-white/[0.035] pl-9 pr-3 text-sm text-zinc-200 outline-none transition placeholder:text-zinc-600 focus:border-[#81ecec]/70 focus:ring-2 focus:ring-[#81ecec]/20" />
          </div>
        </div>

        {applications.isError ? (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 p-5 text-sm text-red-200">
            <span>{applications.error.message}</span>
            <Button size="sm" variant="outline" onClick={() => void applications.refetch()}>Erneut versuchen</Button>
          </div>
        ) : null}
        {applications.isLoading ? <div className="space-y-px p-5">{[1, 2, 3].map((item) => <div key={item} className="h-20 animate-pulse rounded-xl bg-white/[0.04]" />)}</div> : null}
        {!applications.isLoading && !applications.isError && visible.length === 0 ? (
          <DesignEmptyState
            icon={AppWindow}
            title={search ? "Keine passenden Anwendungen" : "Noch keine Anwendungen"}
            description={search ? "Passe die Suche an oder entferne den Suchbegriff." : "Lege den ersten eigenständigen Workload in einem Projekt an."}
            action={search ? undefined : { label: "Anwendung hinzufügen", onClick: () => setCreating(true) }}
          />
        ) : null}

        {!applications.isLoading && !applications.isError && visible.length > 0 ? (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[940px] text-left text-sm">
                <thead className="border-b border-white/[0.06] bg-black/10 text-xs uppercase tracking-[0.1em] text-zinc-500">
                  <tr>
                    <th className="px-5 py-3 font-medium">Anwendung</th>
                    <th className="px-4 py-3 font-medium">Quelle</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Aktualisiert</th>
                    <th className="px-5 py-3 text-right font-medium">Aktionen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {visible.map((application) => (
                    <tr key={application.id} className="transition-colors hover:bg-white/[0.025]">
                      <td className="max-w-64 px-5 py-4">
                        <p className="truncate font-medium text-zinc-100">{application.name}</p>
                        <p className="mt-1 truncate text-xs text-[#81ecec]">{application.projectName}</p>
                        <p className="mt-1 truncate text-xs text-zinc-600">{application.description ?? "Keine Beschreibung"}</p>
                      </td>
                      <td className="max-w-64 px-4 py-4">
                        <span className="inline-flex items-center gap-1.5 text-xs text-zinc-400"><Box className="size-3.5" />{application.sourceType === "git" ? "Git" : "Docker"}</span>
                        <p title={sourceLabel(application)} className="mt-1 truncate font-mono text-xs text-zinc-600">{sourceLabel(application)}</p>
                        <p className="mt-1 inline-flex items-center gap-1 text-xs text-zinc-600"><GitBranch className="size-3" />{application.branch}</p>
                      </td>
                      <td className="px-4 py-4"><ResourceStatusBadge status={application.status === "draft" ? "idle" : application.status} /></td>
                      <td className="px-4 py-4 text-xs text-zinc-500">{dateTime.format(new Date(application.updatedAt))}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-1.5">
                          {applicationActions(application)}
                          <Button type="button" variant="ghost" size="icon" className="size-9" onClick={() => startEditing(application)} aria-label={`${application.name} bearbeiten`}><Pencil className="size-3.5" /></Button>
                          <Button type="button" variant="ghost" size="icon" className="size-9 text-zinc-400 hover:text-red-300" onClick={() => { if (confirm(`Anwendung ${application.name} löschen?`)) remove.mutate(application); }} disabled={remove.isPending} aria-label={`${application.name} löschen`}><Trash2 className="size-3.5" /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-white/[0.06] lg:hidden">
              {visible.map((application) => (
                <article key={application.id} className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-zinc-100">{application.name}</p>
                      <p className="mt-1 truncate text-xs text-[#81ecec]">{application.projectName}</p>
                    </div>
                    <ResourceStatusBadge status={application.status === "draft" ? "idle" : application.status} />
                  </div>
                  <p className="mt-3 truncate text-sm text-zinc-500">{application.description ?? "Keine Beschreibung"}</p>
                  <div className="mt-4 flex min-w-0 items-center gap-3 text-xs text-zinc-500">
                    <span className="inline-flex items-center gap-1"><Box className="size-3.5" />{application.sourceType === "git" ? "Git" : "Docker"}</span>
                    <span className="inline-flex min-w-0 items-center gap-1 truncate"><GitBranch className="size-3.5 shrink-0" />{application.branch}</span>
                  </div>
                  <p title={sourceLabel(application)} className="mt-2 truncate font-mono text-xs text-zinc-600">{sourceLabel(application)}</p>
                  <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-4">
                    {applicationActions(application)}
                    <Button type="button" variant="ghost" size="sm" className="min-h-9" onClick={() => startEditing(application)}><Pencil className="size-3.5" />Bearbeiten</Button>
                    <Button type="button" variant="ghost" size="sm" className="min-h-9 text-zinc-400 hover:text-red-300" onClick={() => { if (confirm(`Anwendung ${application.name} löschen?`)) remove.mutate(application); }} disabled={remove.isPending}><Trash2 className="size-3.5" />Löschen</Button>
                  </div>
                </article>
              ))}
            </div>
          </>
        ) : null}
      </section>

      {editingId ? (
        <section aria-labelledby="edit-application-title" className="rounded-2xl border border-[#0984e3]/25 bg-[#172128] p-5">
          <div className="flex items-start justify-between gap-4">
            <div><h2 id="edit-application-title" className="font-medium text-zinc-100">Anwendung bearbeiten</h2><p className="mt-1 text-sm text-zinc-500">Name, Beschreibung und Standard-Branch anpassen.</p></div>
            <Button type="button" variant="ghost" size="icon" className="size-10" onClick={() => setEditingId(null)} aria-label="Bearbeiten schließen"><X className="size-4" /></Button>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            <label className="text-sm text-zinc-300">Name<input aria-label="Anwendungsname" value={editName} onChange={(event) => setEditName(event.target.value)} maxLength={80} className={inputClassName} /></label>
            <label className="text-sm text-zinc-300">Branch<input aria-label="Branch" value={editBranch} onChange={(event) => setEditBranch(event.target.value)} maxLength={255} className={inputClassName} /></label>
            <label className="text-sm text-zinc-300">Beschreibung <span className="text-zinc-600">(optional)</span><input aria-label="Beschreibung" value={editDescription} onChange={(event) => setEditDescription(event.target.value)} maxLength={500} className={inputClassName} /></label>
          </div>
          {update.error ? <p role="alert" className="mt-4 text-sm text-red-300">{update.error.message}</p> : null}
          <div className="mt-5 flex gap-2"><Button onClick={() => { const application = visible.find((item) => item.id === editingId); if (application) update.mutate(application); }} disabled={!editName.trim() || !editBranch.trim() || update.isPending}>{update.isPending ? "Wird gespeichert …" : "Änderungen speichern"}</Button><Button variant="ghost" onClick={() => setEditingId(null)} disabled={update.isPending}>Abbrechen</Button></div>
        </section>
      ) : null}
    </div>
  );
}
