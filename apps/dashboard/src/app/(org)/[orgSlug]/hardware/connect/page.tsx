"use client";

import { useMutation } from "@tanstack/react-query";
import { Check, Copy, KeyRound, Server } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";

const api = (path: string) => `${process.env.NEXT_PUBLIC_API_URL ?? ""}${path}`;

export default function HardwareConnectPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const [copied, setCopied] = useState(false);
  const token = useMutation({ mutationFn: async () => {
    const response = await fetch(api(`/organizations/${orgSlug}/nodes/registration-tokens`), {
      method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ expiresInSeconds: 3600 }),
    });
    if (!response.ok) throw new Error("Registrierungstoken konnte nicht erstellt werden");
    return response.json() as Promise<{ registrationToken: string; expiresAt: string }>;
  } });
  const command = token.data ? `cd /opt/devion\ndocker compose --env-file deploy/docker/.env -f deploy/docker/docker-compose.yml run --build --rm --no-deps \\\n+  -e DEVION_AGENT_REGISTRATION_TOKEN='${token.data.registrationToken}' \\\n+  -e DEVION_AGENT_ENROLLMENT_ONLY=true \\\n+  agent` : "";
  const copy = async () => { await navigator.clipboard.writeText(command); setCopied(true); window.setTimeout(() => setCopied(false), 2000); };
  return <div className="space-y-6 p-6">
    <div className="flex flex-wrap items-start justify-between gap-3"><PageHeader title="Zusätzlichen Node verbinden" description="Der Devion-Host ist bereits nutzbar. Verbinde hier weitere Hardware für mehr Kapazität." /><Button asChild variant="outline"><Link href={`/${orgSlug}/hardware`}>Zur Hardware</Link></Button></div>
    <section className="max-w-3xl rounded-2xl border border-white/[0.08] bg-[#172128] p-6"><div className="flex items-start gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[#00cec9]/10"><Server className="size-5 text-[#81ecec]" /></span><div><h2 className="font-medium text-zinc-100">1. Registrierungstoken erstellen</h2><p className="mt-1 text-sm leading-6 text-zinc-500">Der Token ist eine Stunde gültig und wird nur einmal angezeigt. Speichere ihn nicht in Quellcode oder Tickets.</p></div></div><Button className="mt-5 min-h-10" disabled={token.isPending} onClick={() => token.mutate()}>{token.isPending ? "Token wird erstellt ..." : <><KeyRound className="size-4" />Einmaligen Token erstellen</>}</Button>{token.error ? <p role="alert" className="mt-3 text-sm text-red-300">{token.error.message}</p> : null}</section>
    {token.data ? <section className="max-w-3xl rounded-2xl border border-[#00cec9]/25 bg-[#172128] p-6"><div className="flex items-start justify-between gap-3"><div><h2 className="font-medium text-zinc-100">2. Agent auf dem Node starten</h2><p className="mt-1 text-sm text-zinc-500">Gültig bis {new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(token.data.expiresAt))}</p></div><Button size="sm" variant="outline" className="min-h-10" onClick={() => void copy()}>{copied ? <><Check className="size-4" />Kopiert</> : <><Copy className="size-4" />Kopieren</>}</Button></div><pre className="mt-5 overflow-x-auto rounded-xl bg-[#080d10] p-4 font-mono text-xs leading-6 text-emerald-200"><code>{command}</code></pre><p className="mt-4 text-sm text-amber-200">Der Registrierungstoken ist geheim und wird nach dem Verlassen dieser Seite nicht erneut angezeigt.</p></section> : null}
  </div>;
}
