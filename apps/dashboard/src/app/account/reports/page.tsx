"use client";
import { BarChart3 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
export default function ReportsPage() { return <div className="space-y-6 py-1"><PageHeader title="Meine Reports" description="Persönliche Nutzung und Aktivitäten auswerten." /><div className="rounded-2xl border border-white/[0.07] bg-[#172128]/90 p-8 text-center"><BarChart3 className="mx-auto size-7 text-[#81ecec]" /><p className="mt-3 text-sm text-zinc-300">Dein erster Report erscheint hier.</p></div></div>; }
