"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
type Settings = { name: string; slug: string; description: string | null };
type Project = Settings & { permissions: string[] };
const api = (path: string) => `${process.env.NEXT_PUBLIC_API_URL ?? ""}${path}`;
export default function ProjectSettingsGeneralPage() {
  const { orgSlug, projectId } = useParams<{ orgSlug: string; projectId: string }>(); const client = useQueryClient();
  const project = useQuery<Project>({ queryKey: ["orgs", orgSlug, "projects", projectId], queryFn: async () => { const response = await fetch(api(`/organizations/${orgSlug}/projects/${projectId}`), { credentials: "include" }); if (!response.ok) throw new Error("Projekt konnte nicht geladen werden"); return response.json(); } });
  const [form, setForm] = useState<Settings>({ name: "", slug: "", description: null }); useEffect(() => { if (project.data) setForm({ name: project.data.name, slug: project.data.slug, description: project.data.description }); }, [project.data]);
  const save = useMutation({ mutationFn: async () => { const response = await fetch(api(`/organizations/${orgSlug}/projects/${projectId}`), { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) }); if (!response.ok) throw new Error((await response.json().catch(() => null))?.error ?? "Speichern fehlgeschlagen"); }, onSuccess: () => void client.invalidateQueries({ queryKey: ["orgs", orgSlug, "projects", projectId] }) });
  const canUpdate = project.data?.permissions.includes("projects.update") ?? false;
  return <div className="space-y-8 p-6"><PageHeader title="Allgemeine Einstellungen" description="Name, URL-Slug und Beschreibung dieses Projects." />{project.isLoading ? <p className="text-sm text-zinc-500">Projekt wird geladen …</p> : <div className="space-y-5 rounded-2xl border border-white/[0.07] bg-[#172128] p-5"><label className="block text-sm text-zinc-300">Name<input disabled={!canUpdate} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="mt-2 h-9 w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 text-zinc-100 disabled:opacity-60" /></label><label className="block text-sm text-zinc-300">Slug<input disabled={!canUpdate} value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value.toLowerCase() })} className="mt-2 h-9 w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 font-mono text-zinc-100 disabled:opacity-60" /></label><label className="block text-sm text-zinc-300">Beschreibung<textarea disabled={!canUpdate} value={form.description ?? ""} onChange={(event) => setForm({ ...form, description: event.target.value || null })} className="mt-2 min-h-24 w-full rounded-lg border border-white/[0.08] bg-white/[0.04] p-3 text-zinc-100 disabled:opacity-60" /></label>{save.error ? <p role="alert" className="text-sm text-red-300">{save.error.message}</p> : null}{canUpdate ? <div className="flex justify-end"><Button onClick={() => save.mutate()} disabled={save.isPending}><Save className="size-3.5" />{save.isPending ? "Speichere …" : "Speichern"}</Button></div> : <p className="text-sm text-zinc-500">Du hast keine Berechtigung, dieses Project zu bearbeiten.</p>}</div>}</div>;
}
