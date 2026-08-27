"use client";
import { useQuery } from "@tanstack/react-query";
import { Activity } from "lucide-react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
type Event = { id: string; action: string; targetType: string; createdAt: string; actorName: string | null; actorEmail: string | null };
const api = (path: string) => `${process.env.NEXT_PUBLIC_API_URL ?? ""}${path}`;
export default function ProjectActivityPage() {
  const { orgSlug, projectId } = useParams<{ orgSlug: string; projectId: string }>();
  const events = useQuery<Event[]>({ queryKey: ["orgs", orgSlug, "projects", projectId, "activity"], queryFn: async () => { const response = await fetch(api(`/organizations/${orgSlug}/projects/${projectId}/activity`), { credentials: "include" }); if (!response.ok) throw new Error("Aktivität konnte nicht geladen werden"); return response.json(); } });
  return <div className="space-y-6 p-6"><PageHeader title="Aktivität" description="Relevante Änderungen und Ereignisse dieses Projects." />{events.isLoading ? <p className="text-sm text-zinc-500">Aktivität wird geladen …</p> : null}{events.isError ? <p role="alert" className="text-sm text-red-300">Aktivität konnte nicht geladen werden.</p> : null}<section className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#172128]">{(events.data ?? []).map((event) => <div key={event.id} className="flex items-center gap-3 border-b border-white/[0.05] px-5 py-4 last:border-0"><Activity className="size-4 shrink-0 text-[#81ecec]" /><div className="min-w-0 flex-1"><p className="text-sm text-zinc-200">{event.action}</p><p className="mt-1 text-xs text-zinc-500">{event.actorName ?? event.actorEmail ?? "System"} · {new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(event.createdAt))}</p></div></div>)}{!events.isLoading && !events.data?.length ? <p className="p-10 text-center text-sm text-zinc-500">Keine aktuellen Aktivitäten.</p> : null}</section></div>;
}
