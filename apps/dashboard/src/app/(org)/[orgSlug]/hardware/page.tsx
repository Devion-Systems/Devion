"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Cpu, HardDrive, MemoryStick, Plus, Server } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { DesignEmptyState } from "@/components/layout/design-empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { ResourceStatusBadge } from "@/components/resources/resource-status-badge";
import { Button } from "@/components/ui/button";

type Quantity = { capacity: number; allocatable: number; reserved: number; usage: number };
type Node = {
  id: string; name: string; hostname: string; status: string; architecture: string; os: string;
  region: string | null; runtimes: string[]; schedulingEnabled: boolean; lastHeartbeatAt: string | null;
  resources: { cpuMilli: Quantity; memoryMib: Quantity; storageMib: Quantity } | null;
};
const api = (path: string) => `${process.env.NEXT_PUBLIC_API_URL ?? ""}${path}`;
const usage = (quantity: Quantity | undefined) => quantity?.capacity ? Math.min(100, Math.round((quantity.usage / quantity.capacity) * 100)) : 0;

function Metric({ icon: Icon, label, quantity, suffix }: { icon: typeof Cpu; label: string; quantity: Quantity | undefined; suffix: string }) {
  const value = usage(quantity);
  return <div className="min-w-0"><div className="flex items-center justify-between gap-2 text-xs text-zinc-500"><span className="inline-flex items-center gap-1"><Icon className="size-3" />{label}</span><span>{value}%</span></div><div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.07]"><div className="h-full rounded-full bg-[#00cec9] transition-[width]" style={{ width: `${value}%` }} /></div><p className="mt-1 truncate text-[11px] text-zinc-600">{quantity ? `${quantity.usage} / ${quantity.capacity} ${suffix}` : "Noch keine Messwerte"}</p></div>;
}

export default function HardwarePage() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const nodes = useQuery<Node[]>({ queryKey: ["org", orgSlug, "nodes"], queryFn: async () => {
    const response = await fetch(api(`/organizations/${orgSlug}/nodes`), { credentials: "include" });
    if (!response.ok) throw new Error("Nodes konnten nicht geladen werden");
    return response.json();
  } });
  return <div className="space-y-6 p-5 sm:p-7">
    <div className="flex flex-wrap items-start justify-between gap-3"><PageHeader title="Hardware" description="Nodes, Kapazität und Live-Zustand deiner Infrastruktur." /><Button asChild className="min-h-10"><Link href={`/${orgSlug}/hardware/connect`}><Plus className="size-4" />Node verbinden</Link></Button></div>
    {nodes.isError ? <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200"><span>{nodes.error.message}</span><Button size="sm" variant="outline" onClick={() => void nodes.refetch()}>Erneut versuchen</Button></div> : null}
    {nodes.isLoading ? <div className="grid gap-4 lg:grid-cols-2"><div className="h-64 animate-pulse rounded-2xl bg-white/[0.05]" /><div className="h-64 animate-pulse rounded-2xl bg-white/[0.05]" /></div> : null}
    {!nodes.isLoading && !nodes.isError && nodes.data?.length === 0 ? <DesignEmptyState icon={Server} title="Infrastruktur verbinden" description="Verbundene Nodes werden hier mit Health, Auslastung und laufenden Workloads angezeigt." detail="Erstelle einen einmaligen Registrierungstoken und installiere anschließend den Devion Agent." /> : null}
    <div className="grid gap-4 lg:grid-cols-2">{(nodes.data ?? []).map((node) => <Link key={node.id} href={`/${orgSlug}/hardware/${node.id}`} className="group rounded-2xl border border-white/[0.08] bg-[#172128] p-5 transition hover:border-[#00cec9]/35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#81ecec]"><div className="flex items-start justify-between gap-4"><div className="min-w-0"><div className="flex items-center gap-2"><Server className="size-5 text-[#81ecec]" /><h2 className="truncate font-medium text-zinc-100">{node.name}</h2></div><p className="mt-2 truncate font-mono text-xs text-zinc-500">{node.hostname} · {node.architecture} · {node.os}</p></div><ResourceStatusBadge status={node.status} /></div><div className="mt-5 grid gap-4 sm:grid-cols-3"><Metric icon={Cpu} label="CPU" quantity={node.resources?.cpuMilli} suffix="m" /><Metric icon={MemoryStick} label="RAM" quantity={node.resources?.memoryMib} suffix="MiB" /><Metric icon={HardDrive} label="Speicher" quantity={node.resources?.storageMib} suffix="MiB" /></div><div className="mt-5 flex items-center justify-between border-t border-white/[0.06] pt-3 text-xs text-zinc-500"><span>{node.schedulingEnabled ? "Scheduling aktiv" : "Scheduling pausiert"}</span><span className="inline-flex items-center gap-1 text-[#81ecec]">Details <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" /></span></div></Link>)}</div>
  </div>;
}
