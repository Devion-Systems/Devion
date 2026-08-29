"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CirclePause, Play } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";

type Node = { name: string; schedulingEnabled: boolean; advertisedAddress: string | null };
type NodeSettings = { schedulingEnabled?: boolean; advertisedAddress?: string | null };
const api = (path: string) => `${process.env.NEXT_PUBLIC_API_URL ?? ""}${path}`;

export default function HardwareSettingsPage() {
  const { orgSlug, nodeId } = useParams<{ orgSlug: string; nodeId: string }>();
  const client = useQueryClient();
  const [advertisedAddress, setAdvertisedAddress] = useState("");
  const node = useQuery<Node>({
    queryKey: ["org", orgSlug, "node", nodeId],
    queryFn: async () => {
      const response = await fetch(api(`/organizations/${orgSlug}/nodes/${nodeId}`), { credentials: "include" });
      if (!response.ok) throw new Error("Node konnte nicht geladen werden");
      return response.json();
    },
  });
  useEffect(() => {
    if (node.data) setAdvertisedAddress(node.data.advertisedAddress ?? "");
  }, [node.data]);
  const update = useMutation({
    mutationFn: async (values: NodeSettings) => {
      const response = await fetch(api(`/organizations/${orgSlug}/nodes/${nodeId}`), {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!response.ok) throw new Error("Node-Einstellung konnte nicht gespeichert werden");
    },
    onSuccess: () => void client.invalidateQueries({ queryKey: ["org", orgSlug, "node", nodeId] }),
  });

  return <div className="space-y-6 p-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <PageHeader title="Node-Einstellungen" description={node.data ? `Betriebssteuerung für ${node.data.name}` : "Betriebssteuerung und Wartung"} />
      <Button asChild variant="outline"><Link href={`/${orgSlug}/hardware/${nodeId}`}>Zur Übersicht</Link></Button>
    </div>
    <section className="max-w-2xl rounded-2xl border border-white/[0.08] bg-[#172128] p-6">
      <h2 className="font-medium text-zinc-100">Scheduling</h2>
      <p className="mt-2 text-sm leading-6 text-zinc-500">Pausiertes Scheduling verhindert neue Platzierungen. Bereits laufende Workloads werden nicht beendet.</p>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-black/10 p-4">
        <div><p className="font-medium text-zinc-200">{node.data?.schedulingEnabled ? "Neue Workloads zulassen" : "Neue Workloads pausiert"}</p><p className="mt-1 text-xs text-zinc-500">{node.data?.schedulingEnabled ? "Der Scheduler darf diesen Node auswählen." : "Geeignet für Wartungsarbeiten oder Entlastung."}</p></div>
        <Button className="min-h-10" variant={node.data?.schedulingEnabled ? "outline" : "default"} disabled={!node.data || update.isPending} onClick={() => update.mutate({ schedulingEnabled: !node.data?.schedulingEnabled })}>{node.data?.schedulingEnabled ? <><CirclePause className="size-4" />Pausieren</> : <><Play className="size-4" />Aktivieren</>}</Button>
      </div>
    </section>
    <section className="max-w-2xl rounded-2xl border border-white/[0.08] bg-[#172128] p-6">
      <h2 className="font-medium text-zinc-100">Workload-Adresse</h2>
      <p className="mt-2 text-sm leading-6 text-zinc-500">Die vom Traefik-Host erreichbare Adresse dieses Nodes. Nur Hostname oder IP-Adresse, ohne Port und URL.</p>
      <div className="mt-5 flex flex-wrap gap-3">
        <input value={advertisedAddress} onChange={(event) => setAdvertisedAddress(event.target.value)} placeholder="10.20.0.15 oder node.internal" className="min-w-64 flex-1 rounded-lg border border-white/[0.1] bg-[#0b1217] px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600" />
        <Button disabled={!node.data || update.isPending} onClick={() => update.mutate({ advertisedAddress: advertisedAddress.trim() || null })}>Adresse speichern</Button>
      </div>
      {!node.data?.advertisedAddress ? <p className="mt-3 text-sm text-amber-300">Ohne Workload-Adresse kann dieser Node keine Domain-Backends bereitstellen.</p> : null}
      {update.error ? <p role="alert" className="mt-3 text-sm text-red-300">{update.error.message}</p> : null}
    </section>
  </div>;
}
