"use client";
import { useParams, useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
export default function DatabasesNewPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const router = useRouter();
  const [name, setName] = useState("");
  const engine = "postgresql";
  const [version, setVersion] = useState("16");
  const [plan, setPlan] = useState("starter");
  const [databaseName, setDatabaseName] = useState("app");
  const [username, setUsername] = useState("devion");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL ?? ""}/organizations/${orgSlug}/databases`,
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          engine,
          version,
          plan,
          databaseName,
          username,
          ...(password ? { password } : {}),
        }),
      },
    );
    if (!response.ok) {
      setMessage("Provisionierung konnte nicht gestartet werden.");
      return;
    }
    const data = (await response.json()) as {
      id: string;
      connection?: { url: string; password: string };
    };
    if (data.connection) {
      sessionStorage.setItem(
        `devion-db-connection:${data.id}`,
        data.connection.url,
      );
    }
    router.push(`/${orgSlug}/databases/${data.id}/settings/general`);
  }
  return (
    <div className="mx-auto max-w-2xl space-y-6 p-5 sm:p-7">
      <PageHeader
        title="Neue Datenbank"
        description="PostgreSQL wird isoliert auf diesem Devion-Host mit dem gewählten Ressourcenprofil bereitgestellt."
      />
      <form
        className="space-y-4 rounded-2xl border border-white/[0.07] bg-[#172128] p-6"
        onSubmit={submit}
      >
        <label
          className="block space-y-2 text-sm text-zinc-300"
          htmlFor="database-name"
        >
          Name
          <input
            id="database-name"
            className="h-10 w-full rounded-xl border border-white/[0.1] bg-[#0b1217] px-3"
            placeholder="app-cache"
            value={name}
            onChange={(event) =>
              setName(
                event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
              )
            }
            required
          />
        </label>
        <div className="rounded-xl border border-white/[0.1] bg-[#0b1217] px-3 py-2 text-sm text-zinc-300">
          Engine: <strong>PostgreSQL</strong>
        </div>
        <label
          className="block space-y-2 text-sm text-zinc-300"
          htmlFor="database-version"
        >
          Version
          <select
            id="database-version"
            className="h-10 w-full rounded-xl border border-white/[0.1] bg-[#0b1217] px-3"
            value={version}
            onChange={(event) => setVersion(event.target.value)}
          >
            <option value="17">PostgreSQL 17 (latest)</option>
            <option value="16">PostgreSQL 16 (recommended)</option>
            <option value="15">PostgreSQL 15</option>
            <option value="14">PostgreSQL 14</option>
          </select>
        </label>
        <fieldset className="space-y-4 rounded-xl border border-white/[0.1] bg-black/10 p-4">
          <legend className="px-1 text-sm font-medium text-zinc-200">Zugangsdaten</legend>
          <p className="text-xs leading-5 text-zinc-500">Diese Werte gelten für den ersten PostgreSQL-Benutzer. Ein leeres Passwort wird sicher automatisch erzeugt und nach der Erstellung einmal angezeigt.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-2 text-sm text-zinc-300" htmlFor="initial-database-name">
              Datenbankname
              <input id="initial-database-name" className="h-10 w-full rounded-xl border border-white/[0.1] bg-[#0b1217] px-3" value={databaseName} onChange={(event) => setDatabaseName(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))} required />
            </label>
            <label className="block space-y-2 text-sm text-zinc-300" htmlFor="initial-username">
              Benutzername
              <input id="initial-username" className="h-10 w-full rounded-xl border border-white/[0.1] bg-[#0b1217] px-3" value={username} onChange={(event) => setUsername(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))} required />
            </label>
          </div>
          <label className="block space-y-2 text-sm text-zinc-300" htmlFor="initial-password">
            Passwort <span className="text-xs font-normal text-zinc-500">optional, mindestens 12 Zeichen</span>
            <input id="initial-password" type="password" minLength={12} className="h-10 w-full rounded-xl border border-white/[0.1] bg-[#0b1217] px-3" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" placeholder="Leer lassen für automatische Generierung" />
          </label>
        </fieldset>
        <label
          className="block space-y-2 text-sm text-zinc-300"
          htmlFor="database-plan"
        >
          Profil
          <select
            id="database-plan"
            className="h-10 w-full rounded-xl border border-white/[0.1] bg-[#0b1217] px-3"
            value={plan}
            onChange={(event) => setPlan(event.target.value)}
          >
            <option value="starter">Starter</option>
            <option value="standard">Standard</option>
            <option value="performance">Performance</option>
          </select>
        </label>
        {message ? <p className="text-sm text-red-300">{message}</p> : null}
        <Button type="submit">Provisionierung starten</Button>
      </form>
    </div>
  );
}
