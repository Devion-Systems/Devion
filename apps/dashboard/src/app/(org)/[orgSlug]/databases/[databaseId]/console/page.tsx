"use client";

import { Database, Table2 } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";

type Table = { schema: string; name: string };
type TableData = { columns: string[]; rows: Record<string, unknown>[]; limit: number };

export default function DatabaseConsolePage() {
  const { orgSlug, databaseId } = useParams<{ orgSlug: string; databaseId: string }>();
  const [tables, setTables] = useState<Table[]>([]);
  const [selected, setSelected] = useState<Table | null>(null);
  const [data, setData] = useState<TableData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const baseUrl = `${process.env.NEXT_PUBLIC_API_URL ?? ""}/organizations/${orgSlug}/databases/${databaseId}/console`;

  useEffect(() => {
    fetch(`${baseUrl}/tables`, { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) throw new Error((await response.json().catch(() => null))?.error ?? "Tables could not be loaded.");
        return response.json() as Promise<{ tables: Table[] }>;
      })
      .then(({ tables: result }) => { setTables(result); setSelected(result[0] ?? null); })
      .catch((cause: Error) => setError(cause.message));
  }, [baseUrl]);

  useEffect(() => {
    if (!selected) { setData(null); return; }
    setError(null);
    fetch(`${baseUrl}/tables/${encodeURIComponent(selected.schema)}/${encodeURIComponent(selected.name)}?limit=100`, { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) throw new Error((await response.json().catch(() => null))?.error ?? "Table data could not be loaded.");
        return response.json() as Promise<TableData>;
      })
      .then(setData)
      .catch((cause: Error) => setError(cause.message));
  }, [baseUrl, selected]);

  return (
    <div className="space-y-6 p-5 sm:p-7">
      <PageHeader title="Data Console" description="Read-only table explorer for this managed PostgreSQL database." />
      {error ? <p className="rounded-xl border border-red-400/25 bg-red-400/10 px-4 py-3 text-sm text-red-100" role="alert">{error}</p> : null}
      <div className="grid min-h-[440px] overflow-hidden rounded-2xl border border-white/[0.08] bg-[#172128] lg:grid-cols-[240px_1fr]">
        <aside className="border-b border-white/[0.08] bg-black/10 p-3 lg:border-b-0 lg:border-r">
          <p className="px-2 pb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">Tables</p>
          {tables.length === 0 ? <p className="px-2 py-4 text-sm text-zinc-500">No user tables yet.</p> : null}
          <div className="space-y-1">{tables.map((table) => <button key={`${table.schema}.${table.name}`} type="button" onClick={() => setSelected(table)} className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition ${selected?.schema === table.schema && selected?.name === table.name ? "bg-[#00CEC9]/15 text-[#bffaf7]" : "text-zinc-400 hover:bg-white/[0.05]"}`}><Table2 className="size-4" /><span className="truncate">{table.name}</span><span className="ml-auto text-[10px] text-zinc-500">{table.schema}</span></button>)}</div>
        </aside>
        <section className="overflow-auto p-4">
          {!selected ? <div className="grid min-h-72 place-items-center text-center text-sm text-zinc-500"><Database className="mb-2 size-6" />Create a table in your database to inspect its data here.</div> : null}
          {selected && data ? <div><div className="mb-4"><h2 className="font-semibold text-zinc-100">{selected.schema}.{selected.name}</h2><p className="mt-1 text-xs text-zinc-500">Read-only preview · first {data.limit} rows</p></div><table className="w-full min-w-max border-separate border-spacing-0 text-left text-sm"><thead><tr>{data.columns.map((column) => <th key={column} className="border-b border-white/[0.1] bg-[#172128] px-3 py-2 font-medium text-zinc-300">{column}</th>)}</tr></thead><tbody>{data.rows.map((row, index) => <tr key={index}>{data.columns.map((column) => <td key={column} className="max-w-72 border-b border-white/[0.05] px-3 py-2 align-top font-mono text-xs text-zinc-400">{typeof row[column] === "object" && row[column] !== null ? JSON.stringify(row[column]) : String(row[column] ?? "NULL")}</td>)}</tr>)}</tbody></table>{data.rows.length === 0 ? <p className="py-10 text-center text-sm text-zinc-500">This table does not contain rows yet.</p> : null}</div> : null}
        </section>
      </div>
    </div>
  );
}
