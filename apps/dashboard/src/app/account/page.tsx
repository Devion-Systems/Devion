"use client";

import { Activity, Bell, CheckCircle2, FolderKanban, Settings, UserRound } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { useSession } from "@/features/auth/hooks/hooks";

const cards = [
  { label: "Organisationen", value: "—", note: "Deine Arbeitsbereiche", icon: FolderKanban },
  { label: "Benachrichtigungen", value: "—", note: "Wichtige Ereignisse", icon: Bell },
  { label: "Aktive Sitzungen", value: "—", note: "Kontosicherheit", icon: Activity },
  { label: "Profilstatus", value: "Aktiv", note: "Konto eingerichtet", icon: CheckCircle2 },
];

export default function AccountOverviewPage() {
  const { data: session, isLoading } = useSession();
  const firstName = session?.user.name?.split(" ")[0] ?? "";
  return <div className="space-y-6 py-1">
    <PageHeader title={isLoading ? "Persönlicher Bereich" : `Willkommen${firstName ? `, ${firstName}` : ""}`} description="Deine Kontodaten, Sicherheit und persönlichen Einstellungen auf einen Blick." />
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(({ label, value, note, icon: Icon }) => <div key={label} className="rounded-2xl border border-white/[0.07] bg-[#172128]/90 p-5"><div className="flex justify-between"><div><p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p><p className="mt-2 text-2xl font-bold text-zinc-100">{value}</p><p className="mt-1 text-xs text-zinc-600">{note}</p></div><Icon className="size-4 text-[#81ecec]" /></div></div>)}</section>
    <section className="grid gap-4 lg:grid-cols-2"><div className="rounded-2xl border border-white/[0.07] bg-[#172128]/90 p-6"><h2 className="font-semibold text-zinc-100">Schnellaktionen</h2><div className="mt-4 grid gap-2 sm:grid-cols-2"><Link href="/account/profile" className="rounded-xl border border-white/[0.08] p-3 text-sm text-zinc-300 hover:border-[#00cec9]/40"><UserRound className="mb-2 size-4 text-[#81ecec]" />Profil bearbeiten</Link><Link href="/account/security" className="rounded-xl border border-white/[0.08] p-3 text-sm text-zinc-300 hover:border-[#00cec9]/40"><Settings className="mb-2 size-4 text-[#81ecec]" />Sicherheit prüfen</Link></div></div><div className="rounded-2xl border border-white/[0.07] bg-[#172128]/90 p-6"><h2 className="font-semibold text-zinc-100">Letzte Aktivität</h2><p className="mt-4 text-sm text-zinc-500">Persönliche Aktivitäten und Benachrichtigungen erscheinen hier, sobald die jeweiligen Dienste Daten liefern.</p></div></section>
  </div>;
}
