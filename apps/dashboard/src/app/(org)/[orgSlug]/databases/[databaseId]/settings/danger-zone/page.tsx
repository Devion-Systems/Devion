"use client";

import { AlertTriangle, Trash2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";

type Database = { id: string; name: string; engine: string; status: string };

export default function DatabasesDetailSettingsDangerZonePage() {
  const { orgSlug, databaseId } = useParams<{ orgSlug: string; databaseId: string }>();
  const router = useRouter();
  const [database, setDatabase] = useState<Database | null>(null);
  const [confirmationName, setConfirmationName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL ?? ""}/organizations/${orgSlug}/databases/${databaseId}`, { credentials: "include" })
      .then((response) => (response.ok ? response.json() : null))
      .then(setDatabase)
      .catch(() => setDatabase(null));
  }, [databaseId, orgSlug]);

  async function deleteDatabase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!database || confirmationName !== database.name) {
      setError("Enter the exact database name to confirm deletion.");
      return;
    }
    setError(null);
    setIsDeleting(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? ""}/organizations/${orgSlug}/databases/${databaseId}`, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmationName }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setError(body?.error ?? "The database could not be deleted.");
        return;
      }
      router.replace(`/${orgSlug}/databases`);
      router.refresh();
    } catch {
      setError("The database could not be deleted.");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="space-y-6 p-5 sm:p-7">
      <PageHeader title="Danger Zone" description="Permanently remove this managed database and all of its data." />
      <form onSubmit={deleteDatabase} className="max-w-2xl rounded-2xl border border-red-400/25 bg-red-400/5 p-6">
        <div className="flex gap-3"><AlertTriangle className="mt-0.5 size-5 shrink-0 text-red-300" /><div><h2 className="font-semibold text-red-100">Delete database</h2><p className="mt-1 text-sm leading-6 text-red-100/70">This stops the database container and permanently deletes its Docker volume, backups and all tables.</p></div></div>
        <label className="mt-5 block text-sm text-red-100/80" htmlFor="database-confirmation">
          Type <code className="rounded bg-red-400/10 px-1.5 py-0.5">{database?.name ?? "…"}</code> to confirm
          <input id="database-confirmation" value={confirmationName} onChange={(event) => setConfirmationName(event.target.value)} disabled={!database || isDeleting} className="mt-2 h-10 w-full rounded-xl border border-red-300/25 bg-black/20 px-3 text-sm text-white outline-none focus:border-red-300/70" autoComplete="off" />
        </label>
        {error ? <p className="mt-3 text-sm text-red-200" role="alert">{error}</p> : null}
        <Button className="mt-5" variant="destructive" type="submit" disabled={!database || isDeleting || confirmationName !== database.name}><Trash2 /> {isDeleting ? "Deleting database…" : "Delete database"}</Button>
      </form>
    </div>
  );
}
