import { CircleDashed } from "lucide-react";
import { cn } from "@/lib/utils";

/** Shown instead of a non-existent action when the control plane lacks a capability. */
export function CapabilityNotice({ title, description, className }: { title: string; description: string; className?: string }) {
  return <section className={cn("rounded-2xl border border-dashed border-[#00cec9]/25 bg-[#00cec9]/[0.035] p-5", className)}><div className="flex gap-3"><CircleDashed className="mt-0.5 size-5 shrink-0 text-[#81ecec]" aria-hidden="true" /><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#81ecec]">Geplant</p><h2 className="mt-1 text-sm font-semibold text-zinc-100">{title}</h2><p className="mt-1 text-sm leading-6 text-zinc-400">{description}</p></div></div></section>;
}
