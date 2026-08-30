"use client";

import { HardDrive, Plus, Trash2 } from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";

type Project = { id: string; name: string };
type Volume = { id: string; name: string; backend: string; status: string; nodeId: string | null; capacityMib: number | null; attachmentCount: number; createdAt: string };
const api = (path: string) => `${process.env.NEXT_PUBLIC_API_URL ?? ""}${path}`;

export default function StoragePage() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const client = useQueryClient();
  const [projectId, setProjectId] = useState("");
  const [name, setName] = useState("");
  const projects = useQuery<{ items: Project[] }>({ queryKey: ["orgs", orgSlug, "projects"], queryFn: async () => { const response = await fetch(api(`/organizations/${orgSlug}/projects`), { credentials: "include" }); if (!response.ok) throw new Error("Projekte konnten nicht geladen werden"); return response.json(); } });
  const selectedProjectId = projectId || projects.data?.items[0]?.id || "";
  const volumes = useQuery<Volume[]>({ enabled: Boolean(selectedProjectId), queryKey: ["org", orgSlug, "project", selectedProjectId, "volumes"], queryFn: async () => { const response = await fetch(api(`/organizations/${orgSlug}/projects/${selectedProjectId}/volumes`), { credentials: "include" }); if (!response.ok) throw new Error("Volumes konnten nicht geladen werden"); return response.json(); } });
  const refresh = () => void client.invalidateQueries({ queryKey: ["org", orgSlug, "project", selectedProjectId, "volumes"] });
  const create = useMutation({ mutationFn: async () => { const response = await fetch(api(`/organizations/${orgSlug}/projects/${selectedProjectId}/volumes`), { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }) }); if (!response.ok) throw new Error((await response.json().catch(() => null))?.error ?? "Volume konnte nicht erstellt werden"); }, onSuccess: () => { setName(""); refresh(); } });
  const remove = useMutation({ mutationFn: async (id: string) => { const response = await fetch(api(`/organizations/${orgSlug}/projects/${selectedProjectId}/volumes/${id}`), { method: "DELETE", credentials: "include" }); if (!response.ok) throw new Error((await response.json().catch(() => null))?.error ?? "Volume konnte nicht gelöscht werden"); }, onSuccess: refresh });
  return (
    <div className="space-y-6 p-6">
      <PageHeader title="Storage" description="Projektgebundene, lokale Docker Volumes. Shared Storage und Backups sind nicht Bestandteil dieser Version." />
      <section className="rounded-2xl border border-white/[0.08] bg-[#172128] p-5">
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-sm text-zinc-400">Projekt<select value={selectedProjectId} onChange={(event) => setProjectId(event.target.value)} className="h-10 min-w-52 rounded-xl border border-white/[0.1] bg-[#0b1217] px-3 text-zinc-100">{(projects.data?.items ?? []).map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
          <label className="grid flex-1 gap-1 text-sm text-zinc-400">Volume-Name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="uploads" className="h-10 rounded-xl border border-white/[0.1] bg-[#0b1217] px-3 text-zinc-100" /></label>
          <Button disabled={!selectedProjectId || !name || create.isPending} onClick={() => create.mutate()}><Plus className="mr-1 size-4" />Volume erstellen</Button>
        </div>
        {create.error || remove.error ? <p role="alert" className="mt-3 text-sm text-red-300">{(create.error ?? remove.error)?.message}</p> : null}
      </section>
      <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#172128]">
        {volumes.isLoading ? <p className="p-5 text-sm text-zinc-500">Volumes werden geladen …</p> : null}
        {(volumes.data ?? []).map((volume) => <div key={volume.id} className="flex items-center gap-4 border-b border-white/[0.06] px-5 py-4 last:border-0"><HardDrive className="size-4 text-[#81ecec]" /><div className="min-w-0 flex-1"><p className="font-medium text-zinc-100">{volume.name}</p><p className="text-xs text-zinc-500">{volume.backend} · {volume.attachmentCount} Attachments · {volume.nodeId ? "node-local" : "noch nicht provisioniert"}{volume.capacityMib ? ` · ${volume.capacityMib} MiB metadata` : ""}</p></div><span className="rounded-full bg-white/[0.06] px-2 py-1 text-xs text-zinc-300">{volume.status}</span><Button size="icon" variant="ghost" aria-label={`${volume.name} löschen`} disabled={volume.attachmentCount > 0 || remove.isPending || volume.status === "deleting"} onClick={() => { if (confirm(`${volume.name} wirklich löschen? Alle Daten werden entfernt.`)) remove.mutate(volume.id); }}><Trash2 className="size-4 text-red-300" /></Button></div>)}
        {!volumes.isLoading && selectedProjectId && !volumes.data?.length ? <p className="p-8 text-center text-sm text-zinc-500">Noch keine Volumes in diesem Projekt.</p> : null}
      </section>
    </div>
  );
}
