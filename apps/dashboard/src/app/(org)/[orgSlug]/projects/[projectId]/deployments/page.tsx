"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Rocket } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { ResourceStatusBadge } from "@/components/resources/resource-status-badge";

type Deployment = { id: string; version: number; status: string; image: string; createdAt: string; rollbackFromDeploymentId: string | null };
type Result = { items: Array<{ deployment: Deployment; application: { id: string; name: string }; revisionState: { isLatest: boolean; isCurrent: boolean; isLastSuccessful: boolean } }>; total: number };
const api = (path: string) => `${process.env.NEXT_PUBLIC_API_URL ?? ""}${path}`;

export default function DeploymentsPage() {
  const { orgSlug, projectId } = useParams<{ orgSlug: string; projectId: string }>();
  const deployments = useQuery<Result>({ queryKey: ["deployments", orgSlug, projectId], enabled: Boolean(orgSlug && projectId), queryFn: async () => { const response = await fetch(api(`/organizations/${orgSlug}/projects/${projectId}/deployments`), { credentials: "include" }); if (!response.ok) throw new Error((await response.json().catch(() => null))?.error ?? "Deployments konnten nicht geladen werden"); return response.json(); } });
  return <div className="space-y-6 p-5 sm:p-7"><PageHeader title="Deployments" description="Nachvollziehbare Release-Historie dieses Projekts." />
    {deployments.isLoading ? <p className="text-sm text-zinc-400">Deployment-Historie wird geladen …</p> : deployments.isError ? <div className="rounded-lg border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200">{deployments.error.message}</div> : deployments.data?.items.length ? <div className="overflow-hidden rounded-xl border border-zinc-800"><div className="hidden grid-cols-[1.2fr_.5fr_1.5fr_.5fr_auto] gap-4 border-b border-zinc-800 bg-zinc-950/60 px-4 py-3 text-xs font-medium uppercase tracking-wide text-zinc-500 md:grid"><span>Anwendung</span><span>Revision</span><span>Artefakt</span><span>Status</span><span /></div>{deployments.data.items.map(({ deployment, application, revisionState }) => <Link key={deployment.id} href={`/${orgSlug}/projects/${projectId}/deployments/${deployment.id}`} className="grid gap-2 border-b border-zinc-800 px-4 py-4 transition hover:bg-zinc-900/60 md:grid-cols-[1.2fr_.5fr_1.5fr_.5fr_auto] md:items-center md:gap-4 last:border-0"><div><p className="font-medium text-zinc-100">{application.name}</p><p className="mt-1 text-xs text-zinc-500">{new Date(deployment.createdAt).toLocaleString("de-DE")}{deployment.rollbackFromDeploymentId ? " · Rollback" : ""}</p></div><span className="text-sm text-zinc-300">v{deployment.version}{revisionState.isCurrent ? <em className="ml-2 rounded bg-emerald-400/10 px-1.5 py-0.5 text-xs not-italic text-emerald-300">Aktuell</em> : revisionState.isLatest ? <em className="ml-2 rounded bg-sky-400/10 px-1.5 py-0.5 text-xs not-italic text-sky-300">Neueste</em> : null}</span><span className="truncate font-mono text-xs text-zinc-400" title={deployment.image}>{deployment.image}</span><ResourceStatusBadge status={deployment.status} /><ArrowRight className="hidden size-4 text-zinc-500 md:block" /></Link>)}</div> : <div className="rounded-xl border border-dashed border-zinc-700 p-10 text-center"><Rocket className="mx-auto size-8 text-zinc-500" /><h2 className="mt-3 font-medium text-zinc-200">Noch keine Deployments</h2><p className="mt-1 text-sm text-zinc-500">Sobald eine Anwendung ausgerollt wird, erscheint hier ihre echte Revisionshistorie.</p></div>}</div>;
}
