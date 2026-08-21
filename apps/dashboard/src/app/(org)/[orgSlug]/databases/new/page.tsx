"use client";

import { useParams, useRouter } from "next/navigation";
import { type FormEvent, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";

const versions = {
  postgresql: ["17", "16", "15", "14"],
  mysql: ["8.4", "8.0"],
  redis: ["7", "6"],
} as const;
const labels = { postgresql: "PostgreSQL", mysql: "MySQL", redis: "Redis" } as const;
type Engine = keyof typeof versions;

export default function DatabasesNewPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const router = useRouter();
  const [name, setName] = useState("");
  const [engine, setEngine] = useState<Engine>("postgresql");
  const [version, setVersion] = useState("16");
  const [databaseName, setDatabaseName] = useState("app");
  const [username, setUsername] = useState("devion");
  const [password, setPassword] = useState("");
  const [publicAccess, setPublicAccess] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const engineVersions = useMemo(() => versions[engine], [engine]);

  function selectEngine(nextEngine: Engine) {
    setEngine(nextEngine);
    setVersion(nextEngine === "postgresql" ? "16" : versions[nextEngine][0]);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? ""}/organizations/${orgSlug}/databases`, {
      method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, engine, version, databaseName, username, publicAccess, ...(password ? { password } : {}) }),
    });
    const result = (await response.json().catch(() => null)) as { error?: string; id?: string; connection?: { url: string } } | null;
    if (!response.ok || !result?.id) { setMessage(result?.error ?? "Provisionierung konnte nicht gestartet werden."); return; }
    if (result.connection?.url) sessionStorage.setItem(`devion-db-connection:${result.id}`, result.connection.url);
    router.push(`/${orgSlug}/databases/${result.id}/settings/general`);
  }
  const isRedis = engine === "redis";
  return <div className="mx-auto max-w-2xl space-y-6 p-5 sm:p-7">
    <PageHeader title="Neue Datenbank" description="PostgreSQL, MySQL und Redis werden isoliert auf diesem Devion-Host bereitgestellt." />
    <form className="space-y-4 rounded-2xl border border-white/[0.07] bg-[#172128] p-6" onSubmit={submit}>
      <label className="block space-y-2 text-sm text-zinc-300" htmlFor="database-name">Name<input id="database-name" className="h-10 w-full rounded-xl border border-white/[0.1] bg-[#0b1217] px-3" placeholder="app-cache" value={name} onChange={(event) => setName(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} required /></label>
      <label className="block space-y-2 text-sm text-zinc-300" htmlFor="database-engine">Engine<select id="database-engine" className="h-10 w-full rounded-xl border border-white/[0.1] bg-[#0b1217] px-3" value={engine} onChange={(event) => selectEngine(event.target.value as Engine)}>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="block space-y-2 text-sm text-zinc-300" htmlFor="database-version">Version<select id="database-version" className="h-10 w-full rounded-xl border border-white/[0.1] bg-[#0b1217] px-3" value={version} onChange={(event) => setVersion(event.target.value)}>{engineVersions.map((item) => <option key={item} value={item}>{labels[engine]} {item}{item === engineVersions[0] ? " (empfohlen)" : ""}</option>)}</select></label>
      <fieldset className="space-y-4 rounded-xl border border-white/[0.1] bg-black/10 p-4"><legend className="px-1 text-sm font-medium text-zinc-200">Zugangsdaten</legend><p className="text-xs leading-5 text-zinc-500">{isRedis ? "Redis nutzt das Passwort zur Authentifizierung. Datenbank und Benutzer werden als Verbindungsmetadaten gespeichert." : `Diese Werte gelten für den ersten ${labels[engine]}-Benutzer.`} Ein leeres Passwort wird sicher automatisch erzeugt und nach der Erstellung einmal angezeigt.</p><div className="grid gap-4 sm:grid-cols-2"><label className="block space-y-2 text-sm text-zinc-300" htmlFor="initial-database-name">{isRedis ? "Datenbankindex" : "Datenbankname"}<input id="initial-database-name" className="h-10 w-full rounded-xl border border-white/[0.1] bg-[#0b1217] px-3" value={databaseName} onChange={(event) => setDatabaseName(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))} required /></label><label className="block space-y-2 text-sm text-zinc-300" htmlFor="initial-username">{isRedis ? "Benutzer" : "Benutzername"}<input id="initial-username" className="h-10 w-full rounded-xl border border-white/[0.1] bg-[#0b1217] px-3" value={username} onChange={(event) => setUsername(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))} required /></label></div><label className="block space-y-2 text-sm text-zinc-300" htmlFor="initial-password">Passwort <span className="text-xs font-normal text-zinc-500">optional, mindestens 12 Zeichen</span><input id="initial-password" type="password" minLength={12} className="h-10 w-full rounded-xl border border-white/[0.1] bg-[#0b1217] px-3" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" placeholder="Leer lassen für automatische Generierung" /></label></fieldset>
      <label className="flex items-start gap-3 rounded-xl border border-white/[0.1] bg-black/10 p-4 text-sm text-zinc-300"><input className="mt-0.5 size-4 accent-[#00cec9]" type="checkbox" checked={publicAccess} onChange={(event) => setPublicAccess(event.target.checked)} /><span><strong className="block text-zinc-100">Öffentlicher Zugriff</strong><span className="mt-1 block text-xs text-zinc-500">Weist einen eigenen TCP-Port für Clients wie pgAdmin zu. Nur aktivieren, wenn der Zugriff benötigt wird.</span></span></label>
      {message ? <p className="text-sm text-red-300">{message}</p> : null}<Button type="submit">Provisionierung starten</Button>
    </form>
  </div>;
}
