"use client";
import { FileText } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
export default function FilesPage() { return <div className="space-y-6 py-1"><PageHeader title="Dateien" description="Deine persönlichen Dokumente und sichere Uploads." /><div className="rounded-2xl border border-dashed border-white/[0.12] bg-[#172128]/50 p-12 text-center"><FileText className="mx-auto size-7 text-[#81ecec]" /><p className="mt-3 text-sm text-zinc-300">Noch keine Dateien vorhanden.</p><p className="mt-1 text-xs text-zinc-600">Der sichere Datei-Upload wird hier angezeigt.</p></div></div>; }
