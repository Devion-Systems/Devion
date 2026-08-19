"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { adminNavGroups, getOrgNavGroups } from "@/config/nav";
import { useOptionalOrgContext } from "@/features/organizations/context/org-context";
import { filterNavGroups } from "@/features/permissions/filter-nav";
import { cn } from "@/lib/utils";

export function MobileNav({ variant }: { variant: "org" | "admin" }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const context = useOptionalOrgContext();
  const groups =
    variant === "admin"
      ? adminNavGroups
      : context
        ? filterNavGroups(getOrgNavGroups(context.org.slug), context.membership)
        : [];

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Navigation öffnen"
        className="grid h-8 w-8 place-items-center rounded-lg text-zinc-400 transition hover:bg-white/[0.06] hover:text-zinc-100"
      >
        <Menu className="h-4 w-4" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-[#071015]/75 backdrop-blur-sm">
          <aside className="flex h-full w-[min(19rem,88vw)] flex-col border-r border-white/[0.08] bg-[#1e272e] shadow-[24px_0_70px_rgba(0,0,0,.4)]">
            <div className="flex h-16 items-center justify-between border-b border-white/[0.07] px-4">
              <Link
                href="/"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 text-sm font-semibold text-zinc-100"
              >
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-[#0984e3] to-[#00cec9] text-[10px] font-black text-[#1e272e]">
                  D
                </span>
                Devion
              </Link>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Navigation schließen"
                className="grid h-8 w-8 place-items-center rounded-lg text-zinc-500 transition hover:bg-white/[0.06] hover:text-zinc-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-5">
              {groups.map((group) => (
                <section key={group.title}>
                  <p className="px-2 pb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-600">
                    {group.title}
                  </p>
                  <div className="space-y-1">
                    {group.items.map((item) => {
                      const active =
                        pathname === item.href ||
                        pathname.startsWith(`${item.href}/`);
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setOpen(false)}
                          className={cn(
                            "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition",
                            active
                              ? "bg-gradient-to-r from-[#0984e3]/18 to-[#00cec9]/[0.07] text-zinc-50 shadow-[inset_2px_0_0_#00cec9]"
                              : "text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-100",
                          )}
                        >
                          <Icon className="h-4 w-4" />
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                </section>
              ))}
            </nav>
          </aside>
          <button
            type="button"
            className="absolute inset-y-0 left-[min(19rem,88vw)] right-0"
            aria-label="Navigation schließen"
            onClick={() => setOpen(false)}
          />
        </div>
      )}
    </div>
  );
}
