"use client";
import { Activity } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
const items = ["Anmeldung erfolgreich", "Profil aktualisiert", "Organisation geöffnet", "Sicherheitseinstellungen geprüft"];
export default function ActivitiesPage() { return <div className="space-y-6 py-1"><PageHeader title="Meine Aktivitäten" description="Chronologische Übersicht deiner persönlichen Kontoaktivitäten." /><div className="rounded-2xl border border-white/[0.07] bg-[#172128]/90 divide-y divide-white/[0.06]">{items.map((item, index) => <div className="flex gap-3 p-4" key={item}><Activity className="mt-0.5 size-4 text-[#81ecec]" /><div><p className="text-sm text-zinc-200">{item}</p><p className="mt-1 text-xs text-zinc-600">Heute · {10 + index}:20</p></div></div>)}</div></div>; }
