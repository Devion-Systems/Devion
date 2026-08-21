"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Download, RefreshCw, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";

type Ref = { name: string; kind: "branch" | "version" };
type Status = { status: "idle" | "running" | "succeeded" | "failed"; ref?: string; updatedAt?: string };

export default function AdminSystemUpdatesPage() {
  const [selectedRef, setSelectedRef] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const { data, refetch, isLoading, error } = useQuery({
    queryKey: ["admin", "system-updates"],
    queryFn: async () => {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? ""}/api/admin/system-updates/status`, { credentials: "include" });
      if (!response.ok) throw new Error("Update service is unavailable.");
      return response.json() as Promise<{ status: Status; refs: Ref[] }>;
    },
    refetchInterval: 5_000,
  });
  const branches = data?.refs.filter((item) => item.kind === "branch") ?? [];
  const versions = data?.refs.filter((item) => item.kind === "version") ?? [];
  const ref = selectedRef || branches.find((item) => item.name === "main")?.name || branches[0]?.name || versions[0]?.name || "";

  async function startUpdate() {
    if (!ref || !confirm(`Update Devion to ${ref}? A control database backup will be created first.`)) return;
    setMessage(null);
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? ""}/api/admin/system-updates/run`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ref }),
    });
    const result = await response.json().catch(() => null);
    setMessage(response.ok ? `Update to ${ref} started. The page will refresh automatically.` : (result?.error ?? "Update could not be started."));
    void refetch();
  }

  return (
    <div className="space-y-6 p-5 sm:p-7">
      <PageHeader title="System Updates" description="Update Devion without deleting configuration, volumes, organizations or projects." />
      {error ? <p className="rounded-xl border border-red-400/25 bg-red-400/10 px-4 py-3 text-sm text-red-100" role="alert">{error instanceof Error ? error.message : "Die verfügbaren Branches konnten nicht geladen werden."}</p> : null}
      <section className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
        <div className="rounded-2xl border border-white/[0.07] bg-[#172128] p-6">
          <div className="flex items-start gap-3"><Download className="mt-0.5 size-5 text-[#00CEC9]" /><div><h2 className="font-semibold text-zinc-100">Select release or branch</h2><p className="mt-1 text-sm text-zinc-500">Only refs fetched from the configured Devion repository can be selected.</p></div></div>
          <label className="mt-5 block text-sm text-zinc-300" htmlFor="system-update-ref">Target version or branch
            <select id="system-update-ref" className="mt-2 h-10 w-full rounded-xl border border-white/[0.1] bg-[#0b1217] px-3" value={ref} onChange={(event) => setSelectedRef(event.target.value)} disabled={isLoading || data?.status.status === "running"}>
              {branches.length ? <optgroup label="Branches">{branches.map((item) => <option key={`branch-${item.name}`} value={item.name}>{item.name}</option>)}</optgroup> : null}
              {versions.length ? <optgroup label="Versions">{versions.map((item) => <option key={`version-${item.name}`} value={item.name}>{item.name}</option>)}</optgroup> : null}
            </select>
          </label>
          {!isLoading && !branches.length && !versions.length ? <p className="mt-2 text-xs text-amber-200">Keine Git-Branches gefunden. Prüfe die Verbindung des Update-Dienstes zu GitHub.</p> : null}
          <div className="mt-5 flex flex-wrap gap-3"><Button type="button" onClick={startUpdate} disabled={!ref || data?.status.status === "running"}><RefreshCw className={data?.status.status === "running" ? "animate-spin" : ""} />{data?.status.status === "running" ? "Update running…" : "Start safe update"}</Button><Button type="button" variant="outline" onClick={() => void refetch()}><RefreshCw />Refresh</Button></div>
          {message ? <p className="mt-4 text-sm text-zinc-300" role="status">{message}</p> : null}
        </div>
        <aside className="rounded-2xl border border-[#00CEC9]/20 bg-[#00CEC9]/5 p-6"><ShieldCheck className="size-5 text-[#00CEC9]" /><h2 className="mt-4 font-semibold text-zinc-100">Data protection</h2><ul className="mt-3 space-y-2 text-sm leading-6 text-zinc-400"><li>• `.env` is copied before each update.</li><li>• The control PostgreSQL database is backed up to `data/backups`.</li><li>• Docker volumes and managed databases are retained.</li><li>• If an update fails, the status is recorded for inspection.</li></ul></aside>
      </section>
      <section className="rounded-2xl border border-white/[0.07] bg-[#172128] p-5"><div className="flex items-center gap-3"><AlertTriangle className="size-4 text-amber-300" /><div><p className="font-medium text-zinc-100">Update status: {data?.status.status ?? "loading"}</p><p className="mt-1 text-sm text-zinc-500">{data?.status.ref ? `${data.status.ref} · ${data.status.updatedAt ?? ""}` : "No update has been started yet."}</p></div></div></section>
    </div>
  );
}
