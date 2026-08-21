"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Database, Plus, RotateCw } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";

type Item = { id: string; name: string; engine: string; version: string; status: string };

export default function DatabasesPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const { data = [], isLoading } = useQuery({
    queryKey: ["org", orgSlug, "databases"],
    queryFn: async () => {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? ""}/organizations/${orgSlug}/databases`, { credentials: "include" });
      if (!response.ok) throw new Error("Datenbanken konnten nicht geladen werden.");
      return response.json() as Promise<Item[]>;
    },
  });

  async function retry(database: Item) {
    setRetryingId(database.id);
    setMessage(null);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? ""}/organizations/${orgSlug}/databases/${database.id}/retry`, { method: "POST", credentials: "include" });
      const result = (await response.json().catch(() => null)) as { error?: string; connection?: { url: string } } | null;
      if (!response.ok) throw new Error(result?.error ?? "Erneuter Versuch fehlgeschlagen.");
      if (result?.connection?.url) sessionStorage.setItem(`devion-db-connection:${database.id}`, result.connection.url);
      await queryClient.invalidateQueries({ queryKey: ["org", orgSlug, "databases"] });
      router.push(`/${orgSlug}/databases/${database.id}/settings/general`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erneuter Versuch fehlgeschlagen.");
    } finally {
      setRetryingId(null);
    }
  }

  return (
    <div className="space-y-6 p-5 sm:p-7">
      <PageHeader title="Datenbanken" description="PostgreSQL-Datenbanken innerhalb dieser Organisation verwalten." />
      <div className="flex justify-end"><Button onClick={() => router.push(`/${orgSlug}/databases/new`)}><Plus /> Datenbank erstellen</Button></div>
      {isLoading ? <p className="text-sm text-zinc-500">Datenbanken werden geladen …</p> : null}
      {message ? <p className="text-sm text-red-300">{message}</p> : null}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.map((database) => (
          <div className="rounded-2xl border border-white/[0.07] bg-[#172128] p-5" key={database.id}>
            <Database className="size-5 text-[#81ecec]" />
            <h2 className="mt-4 font-semibold text-zinc-100">{database.name}</h2>
            <p className="mt-1 text-sm text-zinc-500">{database.engine} {database.version}</p>
            <p className="mt-4 text-xs text-[#81ecec]">{database.status}</p>
            <div className="mt-4 flex gap-2">
              <Button size="sm" variant="outline" onClick={() => router.push(`/${orgSlug}/databases/${database.id}/settings/general`)}>Verwalten</Button>
              {database.status === "failed" ? <Button size="sm" onClick={() => retry(database)} disabled={retryingId === database.id}><RotateCw className={retryingId === database.id ? "animate-spin" : ""} /> Erneut versuchen</Button> : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
