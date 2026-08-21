"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";

type DatabaseNetwork = { engine: string; publicAccess: boolean; publicHost: string | null; publicPort: string | null };

export default function DatabasesDetailSettingsNetworkingPage() {
  const { orgSlug, databaseId } = useParams<{ orgSlug: string; databaseId: string }>();
  const [network, setNetwork] = useState<DatabaseNetwork | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const base = `${process.env.NEXT_PUBLIC_API_URL ?? ""}/organizations/${orgSlug}/databases/${databaseId}`;
  useEffect(() => { fetch(base, { credentials: "include" }).then((response) => response.ok ? response.json() : Promise.reject()).then(setNetwork).catch(() => setMessage("Netzwerkdaten konnten nicht geladen werden.")); }, [base]);
  async function toggle() {
    if (!network) return;
    setSaving(true); setMessage(null);
    try {
      const response = await fetch(`${base}/networking`, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ publicAccess: !network.publicAccess }) });
      const result = (await response.json().catch(() => null)) as Partial<DatabaseNetwork> & { error?: string } | null;
      if (!response.ok) throw new Error(result?.error ?? "Netzwerkzugriff konnte nicht geändert werden.");
      setNetwork((current) => current ? { ...current, ...result } : current);
      setMessage(result?.publicAccess ? "Öffentlicher Zugriff wurde aktiviert. Verwende Host und Port unten in pgAdmin." : "Öffentlicher Zugriff wurde deaktiviert.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Netzwerkzugriff konnte nicht geändert werden."); } finally { setSaving(false); }
  }
  return <div className="space-y-6 p-6"><PageHeader title="Netzwerk" description="Externen Zugriff für Datenbank-Clients wie pgAdmin verwalten." />
    <section className="max-w-2xl space-y-4 rounded-2xl border border-white/[0.07] bg-[#172128] p-6"><div><h2 className="font-semibold text-zinc-100">Öffentlicher Zugriff</h2><p className="mt-1 text-sm text-zinc-500">Aktiviert einen eigenen TCP-Port auf dem Devion-Server. Nur für vertrauenswürdige Clients aktivieren.</p></div><div className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-black/10 p-4"><span className={network?.publicAccess ? "text-[#81ecec]" : "text-zinc-400"}>{network?.publicAccess ? "Aktiviert" : "Deaktiviert"}</span><Button onClick={toggle} disabled={!network || saving}>{saving ? "Wird geändert…" : network?.publicAccess ? "Deaktivieren" : "Aktivieren"}</Button></div>
      {network?.publicAccess && network.publicHost && network.publicPort ? <div className="rounded-xl border border-[#81ecec]/25 bg-[#81ecec]/10 p-4 text-sm text-[#dfffff]"><p className="font-medium">Verbindung für {network.engine}</p><dl className="mt-3 grid grid-cols-2 gap-2 text-xs"><dt className="text-zinc-400">Host</dt><dd className="font-mono">{network.publicHost}</dd><dt className="text-zinc-400">Port</dt><dd className="font-mono">{network.publicPort}</dd></dl><p className="mt-3 text-xs text-zinc-300">Für pgAdmin: Host und Port übernehmen; Datenbank, Benutzer und Passwort stammen aus den einmalig angezeigten Zugangsdaten.</p></div> : null}
      {message ? <p className="text-sm text-zinc-300">{message}</p> : null}
    </section></div>;
}
