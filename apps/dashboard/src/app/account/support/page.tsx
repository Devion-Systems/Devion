"use client";
import { LifeBuoy } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
export default function SupportPage() { return <div className="space-y-6 py-1"><PageHeader title="Hilfe & Support" description="Hilfeartikel, Statusinformationen und Support-Anfragen." /><div className="rounded-2xl border border-white/[0.07] bg-[#172128]/90 p-8"><LifeBuoy className="size-6 text-[#81ecec]" /><p className="mt-3 text-sm text-zinc-300">Wie können wir helfen?</p><p className="mt-1 text-xs text-zinc-600">Support-Anfragen werden hier sicher verwaltet.</p></div></div>; }
