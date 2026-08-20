"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";

type Resources = {
  allocated: { cpuMillicores: number; memoryMib: number; storageGib: number };
  databases: number;
};

export default function ResourcesLimitsPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const { data, isLoading } = useQuery({
    queryKey: ["resources", orgSlug],
    queryFn: async () => {
      const response = await fetch(`/organizations/${orgSlug}/resources`, {
        credentials: "include",
      });
      if (!response.ok)
        throw new Error("Ressourcen konnten nicht geladen werden.");
      return response.json() as Promise<Resources>;
    },
  });
  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Ressourcen-Limits"
        description="Aktuell für verwaltete PostgreSQL-Instanzen reservierte Kapazität."
      />
      {isLoading ? (
        <p className="text-sm text-muted-foreground">
          Ressourcen werden geladen …
        </p>
      ) : null}
      {data ? (
        <div className="grid gap-4 md:grid-cols-3">
          <ResourceCard
            label="CPU"
            value={`${data.allocated.cpuMillicores} mCPU`}
          />
          <ResourceCard
            label="Arbeitsspeicher"
            value={`${data.allocated.memoryMib} MiB`}
          />
          <ResourceCard
            label="Speicher reserviert"
            value={`${data.allocated.storageGib} GiB`}
          />
        </div>
      ) : null}
    </div>
  );
}

function ResourceCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#172128] p-5">
      <p className="text-sm text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-zinc-100">{value}</p>
    </div>
  );
}
