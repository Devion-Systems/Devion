"use client";

import { Search, ShieldCheck } from "lucide-react";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Sidebar } from "@/components/layout/sidebar";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-[#0b1217]">
      <Sidebar variant="admin" />
      <main className="app-surface flex min-w-0 flex-1 flex-col overflow-y-auto">
        <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center justify-between border-b border-white/[0.06] bg-[#0b1217]/82 px-5 backdrop-blur-xl sm:px-7">
          <div className="flex items-center gap-3 text-xs text-zinc-500">
            <MobileNav variant="admin" />
            <span className="grid h-6 w-6 place-items-center rounded-lg border border-amber-300/15 bg-amber-300/[0.07] text-amber-200">
              <ShieldCheck className="h-3.5 w-3.5" />
            </span>
            Plattform-Administration
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="hidden h-8 items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 text-xs text-zinc-500 transition hover:border-white/[0.12] hover:text-zinc-300 md:flex"
            >
              <Search className="h-3.5 w-3.5" />
              Suchen
            </button>
          </div>
        </header>
        <div className="mx-auto w-full max-w-[1600px] flex-1">{children}</div>
      </main>
    </div>
  );
}
