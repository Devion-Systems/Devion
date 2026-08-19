"use client";
import { useQuery } from "@tanstack/react-query";
import { Database, Plus } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";

type Item = {
  id: string;
  name: string;
  engine: string;
  version: string;
  plan: string;
  status: string;
};
export default function DatabasesPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const router = useRouter();
  const { data = [], isLoading } = useQuery({
    queryKey: ["org", orgSlug, "databases"],
    queryFn: async () => {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? ""}/organizations/${orgSlug}/databases`,
        { credentials: "include" },
      );
      if (!response.ok)
        throw new Error("Datenbanken konnten nicht geladen werden.");
      return response.json() as Promise<Item[]>;
    },
  });
  return (
    <div className="space-y-6 p-5 sm:p-7">
      <PageHeader
        title="Datenbanken"
        description="PostgreSQL, MySQL und Redis innerhalb dieser Organisation verwalten."
      />
      <div className="flex justify-end">
        <Button onClick={() => router.push(`/${orgSlug}/databases/new`)}>
          <Plus /> Datenbank erstellen
        </Button>
      </div>
      {isLoading ? (
        <p className="text-sm text-zinc-500">Datenbanken werden geladen …</p>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.map((database) => (
          <button
            className="rounded-2xl border border-white/[0.07] bg-[#172128] p-5 text-left"
            key={database.id}
            onClick={() =>
              router.push(
                `/${orgSlug}/databases/${database.id}/settings/general`,
              )
            }
            type="button"
          >
            <Database className="size-5 text-[#81ecec]" />
            <h2 className="mt-4 font-semibold text-zinc-100">
              {database.name}
            </h2>
            <p className="mt-1 text-sm text-zinc-500">
              {database.engine} {database.version} · {database.plan}
            </p>
            <p className="mt-4 text-xs text-[#81ecec]">{database.status}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
