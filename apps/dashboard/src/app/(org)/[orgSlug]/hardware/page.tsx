"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  CheckCircle2,
  Cpu,
  HardDrive,
  MemoryStick,
  Plus,
  Server,
  SlidersHorizontal,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { DesignEmptyState } from "@/components/layout/design-empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { ResourceStatusBadge } from "@/components/resources/resource-status-badge";
import { Button } from "@/components/ui/button";

type Quantity = {
  capacity: number;
  allocatable: number;
  reserved: number;
  usage: number;
};

type Node = {
  id: string;
  name: string;
  hostname: string;
  status: string;
  architecture: string;
  os: string;
  region: string | null;
  runtimes: string[];
  schedulingEnabled: boolean;
  lastHeartbeatAt: string | null;
  resources: {
    cpuMilli: Quantity;
    memoryMib: Quantity;
    storageMib: Quantity;
  } | null;
};

const api = (path: string) => `${process.env.NEXT_PUBLIC_API_URL ?? ""}${path}`;
const number = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 });

function getUsage(quantity: Quantity | undefined) {
  if (!quantity?.capacity) return 0;
  return Math.min(100, Math.round((quantity.usage / quantity.capacity) * 100));
}

function formatQuantity(quantity: Quantity | undefined, suffix: string) {
  if (!quantity) return "Noch keine Messwerte";
  return `${number.format(quantity.usage)} / ${number.format(quantity.capacity)} ${suffix}`;
}

function ResourceMetric({
  icon: Icon,
  label,
  quantity,
  suffix,
}: {
  icon: typeof Cpu;
  label: string;
  quantity: Quantity | undefined;
  suffix: string;
}) {
  const value = getUsage(quantity);

  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between gap-2 text-xs text-zinc-400">
        <span className="inline-flex items-center gap-1.5">
          <Icon className="size-3.5 text-zinc-500" />
          {label}
        </span>
        <span className="font-medium text-zinc-200">{value}%</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
        <div
          className="h-full rounded-full bg-[#00cec9] transition-[width] duration-300"
          style={{ width: `${value}%` }}
        />
      </div>
      <p className="mt-1.5 truncate text-[11px] text-zinc-600">{formatQuantity(quantity, suffix)}</p>
    </div>
  );
}

function NodeIdentity({ node }: { node: Node }) {
  return (
    <div className="min-w-0">
      <div className="flex min-w-0 items-center gap-2">
        <Server className="size-4 shrink-0 text-[#81ecec]" />
        <span className="truncate font-medium text-zinc-100">{node.name}</span>
      </div>
      <p className="mt-1 truncate font-mono text-xs text-zinc-500">{node.hostname}</p>
      <p className="mt-1 truncate text-xs text-zinc-600">
        {node.architecture} · {node.os}
        {node.region ? ` · ${node.region}` : ""}
      </p>
    </div>
  );
}

export default function HardwarePage() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const nodes = useQuery<Node[]>({
    queryKey: ["org", orgSlug, "nodes"],
    queryFn: async () => {
      const response = await fetch(api(`/organizations/${orgSlug}/nodes`), {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Nodes konnten nicht geladen werden");
      return response.json();
    },
  });

  const nodeList = nodes.data ?? [];
  const onlineNodes = nodeList.filter((node) => ["ready", "healthy", "online"].includes(node.status.toLowerCase()));
  const schedulableNodes = nodeList.filter((node) => node.schedulingEnabled);

  return (
    <div className="space-y-6 p-5 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title="Hardware"
          description="Überwache Kapazität und Verfügbarkeit der Infrastruktur, auf der deine Workloads laufen."
        />
        <Button asChild className="min-h-10">
          <Link href={`/${orgSlug}/hardware/connect`}>
            <Plus className="size-4" />
            Node verbinden
          </Link>
        </Button>
      </div>

      {nodes.isError ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200"
        >
          <span>{nodes.error.message}</span>
          <Button size="sm" variant="outline" onClick={() => void nodes.refetch()}>
            Erneut versuchen
          </Button>
        </div>
      ) : null}

      {nodes.isLoading ? (
        <div className="space-y-4">
          <div className="h-28 animate-pulse rounded-2xl bg-white/[0.05]" />
          <div className="h-72 animate-pulse rounded-2xl bg-white/[0.05]" />
        </div>
      ) : null}

      {!nodes.isLoading && !nodes.isError && nodeList.length === 0 ? (
        <DesignEmptyState
          icon={Server}
          title="Infrastruktur verbinden"
          description="Verbinde eine Node, damit Devion Kapazität messen und Workloads darauf ausführen kann."
          detail="Für den Betrieb auf dieser Hardware ist der lokale Devion Agent ausreichend; weitere Nodes fügst du nur bei zusätzlichem Bedarf hinzu."
          action={{ label: "Node verbinden", href: `/${orgSlug}/hardware/connect` }}
        />
      ) : null}

      {!nodes.isLoading && !nodes.isError && nodeList.length > 0 ? (
        <>
          <section aria-label="Infrastrukturstatus" className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/[0.08] bg-[#172128] p-4">
              <p className="text-xs font-medium uppercase tracking-[0.12em] text-zinc-500">Verbundene Nodes</p>
              <p className="mt-2 text-2xl font-semibold tracking-tight text-zinc-50">{nodeList.length}</p>
              <p className="mt-1 text-sm text-zinc-500">In deiner Organisation registriert</p>
            </div>
            <div className="rounded-2xl border border-white/[0.08] bg-[#172128] p-4">
              <p className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.12em] text-zinc-500">
                <CheckCircle2 className="size-3.5" /> Betriebsbereit
              </p>
              <p className="mt-2 text-2xl font-semibold tracking-tight text-zinc-50">{onlineNodes.length}</p>
              <p className="mt-1 text-sm text-zinc-500">Von {nodeList.length} Nodes erreichbar</p>
            </div>
            <div className="rounded-2xl border border-white/[0.08] bg-[#172128] p-4">
              <p className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.12em] text-zinc-500">
                <SlidersHorizontal className="size-3.5" /> Scheduling aktiv
              </p>
              <p className="mt-2 text-2xl font-semibold tracking-tight text-zinc-50">{schedulableNodes.length}</p>
              <p className="mt-1 text-sm text-zinc-500">Nodes nehmen neue Workloads an</p>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#172128]">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.07] px-5 py-4">
              <div>
                <h2 className="font-medium text-zinc-100">Infrastruktur</h2>
                <p className="mt-1 text-sm text-zinc-500">Wähle eine Node für Runtime-, Netzwerk- und Detailinformationen.</p>
              </div>
              <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-xs text-zinc-400">
                {nodeList.length} {nodeList.length === 1 ? "Node" : "Nodes"}
              </span>
            </div>

            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="border-b border-white/[0.06] bg-black/10 text-xs uppercase tracking-[0.1em] text-zinc-500">
                  <tr>
                    <th className="px-5 py-3 font-medium">Node</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">CPU</th>
                    <th className="px-4 py-3 font-medium">Arbeitsspeicher</th>
                    <th className="px-4 py-3 font-medium">Speicher</th>
                    <th className="px-4 py-3 font-medium">Scheduling</th>
                    <th className="px-5 py-3 text-right font-medium"><span className="sr-only">Details</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {nodeList.map((node) => (
                    <tr key={node.id} className="group transition-colors hover:bg-white/[0.025]">
                      <td className="px-5 py-4"><NodeIdentity node={node} /></td>
                      <td className="px-4 py-4"><ResourceStatusBadge status={node.status} /></td>
                      <td className="min-w-40 px-4 py-4"><ResourceMetric icon={Cpu} label="CPU" quantity={node.resources?.cpuMilli} suffix="m" /></td>
                      <td className="min-w-44 px-4 py-4"><ResourceMetric icon={MemoryStick} label="RAM" quantity={node.resources?.memoryMib} suffix="MiB" /></td>
                      <td className="min-w-40 px-4 py-4"><ResourceMetric icon={HardDrive} label="Disk" quantity={node.resources?.storageMib} suffix="MiB" /></td>
                      <td className="px-4 py-4">
                        <span className={node.schedulingEnabled ? "text-sm text-emerald-300" : "text-sm text-zinc-500"}>
                          {node.schedulingEnabled ? "Aktiv" : "Pausiert"}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Button asChild variant="ghost" size="sm" className="min-h-9 text-zinc-300 hover:text-[#81ecec]">
                          <Link href={`/${orgSlug}/hardware/${node.id}`}>Details <ArrowRight className="size-3.5" /></Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-white/[0.06] lg:hidden">
              {nodeList.map((node) => (
                <Link
                  key={node.id}
                  href={`/${orgSlug}/hardware/${node.id}`}
                  className="block p-5 transition-colors hover:bg-white/[0.025] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#81ecec]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <NodeIdentity node={node} />
                    <ResourceStatusBadge status={node.status} />
                  </div>
                  <div className="mt-5 grid gap-4 sm:grid-cols-3">
                    <ResourceMetric icon={Cpu} label="CPU" quantity={node.resources?.cpuMilli} suffix="m" />
                    <ResourceMetric icon={MemoryStick} label="RAM" quantity={node.resources?.memoryMib} suffix="MiB" />
                    <ResourceMetric icon={HardDrive} label="Speicher" quantity={node.resources?.storageMib} suffix="MiB" />
                  </div>
                  <div className="mt-5 flex items-center justify-between border-t border-white/[0.06] pt-3 text-xs text-zinc-500">
                    <span>{node.schedulingEnabled ? "Scheduling aktiv" : "Scheduling pausiert"}</span>
                    <span className="inline-flex items-center gap-1 font-medium text-[#81ecec]">Details <ArrowRight className="size-3.5" /></span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
