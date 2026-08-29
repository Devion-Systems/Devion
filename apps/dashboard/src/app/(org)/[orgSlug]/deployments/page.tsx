"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Rocket } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { ResourceStatusBadge } from "@/components/resources/resource-status-badge";

type Result = { items: Array<{ deployment: { id: string; version: number; status: string; image: string; createdAt: string }; application: { name: string }; project: { id: string; name: string } }> };
const api = (path: string) => `${process.env.NEXT_PUBLIC_API_URL ?? ""}${path}`;

export default function DeploymentsPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const deployments = useQuery<Result>({ queryKey: ["org", orgSlug, "deployments"], enabled: Boolean(orgSlug), queryFn: async () => { const response = await fetch(api(`/organizations/${orgSlug}/deployments`), { credentials: "include" }); if (!response.ok) throw new Error((await response.json().catch(() => null))?.error ?? "Deployments konnten nicht geladen werden"); return response.json(); } });
  return <div className="space-y-6 p-5 sm:p-7"><PageHeader title="Deployments" description="Release-Historie über alle zugänglichen Projekte." />{deployments.isLoading ? <p className="text-sm text-zinc-400">Deployments werden geladen …</p> : deployments.isError ? <div className="rounded-lg border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200">{deployments.error.message}</div> : deployments.data?.items.length ? <div className="overflow-hidden rounded-xl border border-zinc-800">{deployments.data.items.map(({ deployment, application, project }) => <Link key={deployment.id} href={`/${orgSlug}/projects/${project.id}/deployments/${deployment.id}`} className="grid gap-2 border-b border-zinc-800 px-4 py-4 transition hover:bg-zinc-900/60 md:grid-cols-[1fr_1fr_.5fr_2fr_.5fr_auto] md:items-center"><span className="text-sm text-zinc-400">{project.name}</span><span className="font-medium text-zinc-100">{application.name}</span><span>v{deployment.version}</span><span className="truncate font-mono text-xs text-zinc-500">{deployment.image}</span><ResourceStatusBadge status={deployment.status} /><ArrowRight className="hidden size-4 text-zinc-500 md:block" /></Link>)}</div> : <div className="rounded-xl border border-dashed border-zinc-700 p-10 text-center"><Rocket className="mx-auto size-8 text-zinc-500" /><h2 className="mt-3 font-medium text-zinc-200">Keine Deployments</h2><p className="mt-1 text-sm text-zinc-500">Hier erscheinen nur reale Revisionsdaten aus Projekten, auf die du Zugriff hast.</p></div>}</div>;
}
