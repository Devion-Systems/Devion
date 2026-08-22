"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Database, Plus, RefreshCw, RotateCw } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { DesignEmptyState } from "@/components/layout/design-empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { ResourceStatusBadge } from "@/components/resources/resource-status-badge";
import { Button } from "@/components/ui/button";

type Item = { id: string; name: string; engine: string; version: string; status: string };
const api = (path: string) => `${process.env.NEXT_PUBLIC_API_URL ?? ""}${path}`;

export default function DatabasesPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const { data = [], isLoading, isError, refetch } = useQuery<Item[]>({
    queryKey: ["org", orgSlug, "databases"],
    queryFn: async () => {
      const response = await fetch(api(`/organizations/${orgSlug}/databases`), { credentials: "include" });
      if (!response.ok) throw new Error("Datenbanken konnten nicht geladen werden");
      return response.json();
    },
  });

  async function retry(database: Item) {
    setRetryingId(database.id);
    setMessage(null);
    try {
      const response = await fetch(api(`/organizations/${orgSlug}/databases/${database.id}/retry`), { method: "POST", credentials: "include" });
      const result = (await response.json().catch(() => null)) as { error?: string; connection?: { url: string } } | null;
      if (!response.ok) throw new Error(result?.error ?? "Erneuter Versuch fehlgeschlagen");
      if (result?.connection?.url) sessionStorage.setItem(`devion-db-connection:${database.id}`, result.connection.url);
      await queryClient.invalidateQueries({ queryKey: ["org", orgSlug, "databases"] });
      router.push(`/${orgSlug}/databases/${database.id}/settings/general`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erneuter Versuch fehlgeschlagen");
    } finally {
      setRetryingId(null);
    }
  }

  return (
    <main className="flex flex-col gap-6 p-5 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1"><PageHeader title="Datenbanken" description="Verfügbarkeit, Version und Zugang deiner verwalteten Datenbanken." /></div>
        <Button asChild size="lg"><Link href={`/${orgSlug}/databases/new`}><Plus data-icon="inline-start" />Datenbank erstellen</Link></Button>
      </div>

      {isError ? <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-100"><span>Datenbanken konnten nicht geladen werden. Prüfe die Verbindung und versuche es erneut.</span><Button size="sm" variant="outline" onClick={() => void refetch()}><RefreshCw data-icon="inline-start" />Erneut laden</Button></div> : null}
      {message ? <p role="alert" className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-100">{message}</p> : null}

      <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#172128]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] px-5 py-4"><div><h2 className="font-medium text-zinc-100">Datenbanken</h2><p className="mt-1 text-sm text-zinc-500">{isLoading ? "Datenbanken werden geladen …" : `${data.length} ${data.length === 1 ? "Datenbank" : "Datenbanken"} in dieser Organisation`}</p></div><Button size="sm" variant="ghost" onClick={() => void refetch()}><RefreshCw data-icon="inline-start" />Aktualisieren</Button></div>
        {isLoading ? <div aria-busy="true" className="divide-y divide-white/[0.06] px-5 py-2">{[1, 2, 3].map((item) => <div key={item} className="h-16 border-b border-white/[0.06] last:border-0" />)}</div> : null}
        {!isLoading && !isError && data.length > 0 ? <><div className="hidden overflow-x-auto md:block"><table className="w-full text-left text-sm"><thead className="border-b border-white/[0.08] text-xs uppercase tracking-wide text-zinc-500"><tr><th className="px-5 py-3 font-medium">Datenbank</th><th className="px-4 py-3 font-medium">Engine</th><th className="px-4 py-3 font-medium">Version</th><th className="px-4 py-3 font-medium">Status</th><th className="px-5 py-3 text-right font-medium">Aktionen</th></tr></thead><tbody className="divide-y divide-white/[0.06]">{data.map((database) => <tr key={database.id} className="hover:bg-white/[0.025]"><td className="px-5 py-4"><Link href={`/${orgSlug}/databases/${database.id}/settings/general`} className="flex min-w-0 items-center gap-3 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#81ecec]"><Database className="size-4 shrink-0 text-[#81ecec]" /><span className="truncate font-medium text-zinc-100">{database.name}</span></Link></td><td className="px-4 py-4 text-zinc-300">{database.engine}</td><td className="px-4 py-4 font-mono text-xs text-zinc-400">{database.version}</td><td className="px-4 py-4"><ResourceStatusBadge status={database.status} /></td><td className="px-5 py-4"><div className="flex justify-end gap-2">{database.status === "failed" ? <Button size="sm" disabled={retryingId === database.id} onClick={() => void retry(database)}>{retryingId === database.id ? <RotateCw className="animate-spin" /> : <RotateCw data-icon="inline-start" />}Erneut versuchen</Button> : null}<Button asChild size="sm" variant="ghost"><Link href={`/${orgSlug}/databases/${database.id}/settings/general`}>Verwalten<ArrowRight data-icon="inline-end" /></Link></Button></div></td></tr>)}</tbody></table></div><div className="divide-y divide-white/[0.06] md:hidden">{data.map((database) => <article key={database.id} className="px-4 py-4"><div className="flex items-start gap-3"><Database className="mt-0.5 size-4 shrink-0 text-[#81ecec]" /><div className="min-w-0 flex-1"><Link href={`/${orgSlug}/databases/${database.id}/settings/general`} className="block truncate font-medium text-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#81ecec]">{database.name}</Link><p className="mt-1 font-mono text-xs text-zinc-500">{database.engine} · {database.version}</p></div><ResourceStatusBadge status={database.status} /></div><div className="mt-3 flex gap-2">{database.status === "failed" ? <Button size="sm" disabled={retryingId === database.id} onClick={() => void retry(database)}>{retryingId === database.id ? <RotateCw className="animate-spin" /> : <RotateCw data-icon="inline-start" />}Wiederholen</Button> : null}<Button asChild size="sm" variant="ghost"><Link href={`/${orgSlug}/databases/${database.id}/settings/general`}>Verwalten</Link></Button></div></article>)}</div></> : null}
        {!isLoading && !isError && data.length === 0 ? <DesignEmptyState icon={Database} title="Noch keine Datenbanken" description="Erstelle eine Datenbank, um Zugang, Backups und Ressourcen zentral zu verwalten." detail="Du kannst PostgreSQL, MySQL oder Redis bereitstellen." action={{ label: "Datenbank erstellen", href: `/${orgSlug}/databases/new` }} /> : null}
      </section>
    </main>
  );
}
