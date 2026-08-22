import { ArrowUpRight, Sparkles } from "lucide-react";
import type { ElementType } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function DesignEmptyState({
  icon: Icon,
  title,
  description,
  detail = "Die Daten werden automatisch angezeigt, sobald die jeweilige Integration verbunden ist.",
  action,
}: {
  icon: ElementType;
  title: string;
  description: string;
  detail?: string;
  action?: { label: string; href?: string; onClick?: () => void };
}) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#1e272e]/90 px-5 py-12 text-center shadow-[0_16px_48px_rgba(0,0,0,.14)] sm:px-10">
      <div className="pointer-events-none absolute left-1/2 top-0 h-40 w-80 -translate-x-1/2 rounded-full bg-[#0984e3]/10 blur-[70px]" />
      <div className="relative mx-auto flex max-w-md flex-col items-center">
        <span className="grid h-[3.25rem] w-[3.25rem] place-items-center rounded-2xl border border-[#00cec9]/18 bg-gradient-to-br from-[#0984e3]/15 to-[#00cec9]/[0.07] shadow-[0_12px_30px_rgba(9,132,227,.12)]">
          <Icon className="h-5 w-5 text-[#81ecec]" />
        </span>
        <div className="mt-5 flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[#00cec9]/75">
          <Sparkles className="h-3 w-3" /> Bereit zur Einrichtung
        </div>
        <h2 className="mt-2 text-base font-semibold text-zinc-100">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-500">{description}</p>
        <p className="mt-5 flex items-center gap-1.5 text-xs text-zinc-600">
          <ArrowUpRight className="h-3.5 w-3.5 text-[#74b9ff]" />
          {detail}
        </p>
        {action?.href ? <Button asChild size="sm" className="mt-5"><Link href={action.href}>{action.label}</Link></Button> : null}
        {action?.onClick ? <Button size="sm" className="mt-5" onClick={action.onClick}>{action.label}</Button> : null}
      </div>
    </section>
  );
}
