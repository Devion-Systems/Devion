"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";

type Team = { id: string; name: string };
const api = (path: string) => `${process.env.NEXT_PUBLIC_API_URL ?? ""}${path}`;

export default function TeamSettingsPage() {
  const { orgSlug, teamSlug } = useParams<{ orgSlug: string; teamSlug: string }>(); const router = useRouter(); const client = useQueryClient();
  const { data } = useQuery<Team>({ queryKey: ["org", orgSlug, "team", teamSlug], queryFn: async () => { const r = await fetch(api(`/organizations/${orgSlug}/teams/${teamSlug}`), { credentials: "include" }); if (!r.ok) throw new Error("Team nicht gefunden"); return r.json(); } });
  const [name, setName] = useState(""); const [message, setMessage] = useState<string | null>(null); const currentName = name || data?.name || "";
  async function save() { const r = await fetch(api(`/organizations/${orgSlug}/teams/${teamSlug}`), { method: "PATCH", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: currentName }) }); setMessage(r.ok ? "Team gespeichert." : "Team konnte nicht gespeichert werden."); if (r.ok) void client.invalidateQueries({ queryKey: ["org", orgSlug, "team", teamSlug] }); }
  async function remove() { if (!data || !confirm(`Team ${data.name} löschen? Zugewiesene Projekte bleiben in der Organisation.`)) return; const r = await fetch(api(`/organizations/${orgSlug}/teams/${teamSlug}`), { method: "DELETE", credentials: "include" }); if (r.ok) router.replace(`/${orgSlug}/teams`); else setMessage("Team konnte nicht gelöscht werden."); }
  return <div className="mx-auto max-w-2xl space-y-6 p-6"><PageHeader title="Team-Einstellungen" description="Ein Team ist eine Arbeitsgruppe innerhalb der Organisation." /><section className="space-y-4 rounded-2xl border border-white/[0.07] bg-[#172128] p-5"><label className="block text-sm text-zinc-300">Teamname<input value={currentName} onChange={(event) => setName(event.target.value)} maxLength={80} className="mt-2 h-10 w-full rounded-xl border border-white/[0.1] bg-[#0b1217] px-3 text-zinc-100" /></label><Button onClick={save}>Speichern</Button>{message ? <p className="text-sm text-zinc-400">{message}</p> : null}</section><section className="rounded-2xl border border-red-400/20 bg-red-400/[0.04] p-5"><h2 className="font-semibold text-red-100">Gefahrenzone</h2><p className="mt-1 text-sm text-zinc-400">Das Löschen entfernt nur das Team und seine Mitgliedschaftszuweisungen. Organisationsmitglieder und Projekte bleiben erhalten.</p><Button variant="destructive" className="mt-4" onClick={remove}>Team löschen</Button></section></div>;
}
