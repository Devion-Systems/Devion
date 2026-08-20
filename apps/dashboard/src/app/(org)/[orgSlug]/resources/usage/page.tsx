"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";

export default function ResourcesUsagePage() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const { data } = useQuery({
    queryKey: ["resources", orgSlug],
    queryFn: async () => {
      const response = await fetch(`/organizations/${orgSlug}/resources`, {
        credentials: "include",
      });
      if (!response.ok)
        throw new Error("Ressourcen konnten nicht geladen werden.");
      return response.json() as Promise<{
        allocated: {
          cpuMillicores: number;
          memoryMib: number;
          storageGib: number;
        };
        databases: number;
      }>;
    },
  });
  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Ressourcennutzung"
        description="Aktive Datenbanken und ihre vom Host garantierte Kapazität."
      />
      <div className="rounded-2xl border border-white/[0.07] bg-[#172128] p-5 text-sm text-zinc-300">
        <p>
          <strong>{data?.databases ?? 0}</strong> verwaltete
          PostgreSQL-Instanzen
        </p>
        <p className="mt-2 text-zinc-500">
          Reserviert: {data?.allocated.cpuMillicores ?? 0} mCPU ·{" "}
          {data?.allocated.memoryMib ?? 0} MiB RAM ·{" "}
          {data?.allocated.storageGib ?? 0} GiB Speicher
        </p>
      </div>
    </div>
  );
}
