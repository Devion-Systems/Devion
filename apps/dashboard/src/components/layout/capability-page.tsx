import type { ElementType } from "react";
import { Construction } from "lucide-react";
import { CapabilityNotice } from "./capability-notice";
import { PageHeader } from "./page-header";

/** Honest, consistent fallback for dashboard sections without a backing service yet. */
export function CapabilityPage({ title, description, noticeTitle = "Noch nicht verfügbar", noticeDescription, icon: Icon = Construction }: { title: string; description: string; noticeTitle?: string; noticeDescription: string; icon?: ElementType }) {
  return <div className="space-y-6 p-6"><PageHeader title={title} description={description} /><div className="rounded-2xl border border-white/[0.08] bg-[#172128] p-5"><Icon className="size-5 text-[#81ecec]" aria-hidden="true" /><CapabilityNotice className="mt-4" title={noticeTitle} description={noticeDescription} /></div></div>;
}
