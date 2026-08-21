"use client";

import { Bell, KeyRound, Laptop, LockKeyhole, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const accountNavigation = [
  { href: "/account/profile", label: "Profil", icon: UserRound },
  { href: "/account/security", label: "Sicherheit", icon: LockKeyhole },
  { href: "/account/sessions", label: "Sitzungen", icon: Laptop },
  { href: "/account/api-keys", label: "API-Schlüssel", icon: KeyRound },
  { href: "/account/notifications", label: "Benachrichtigungen", icon: Bell },
];

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="app-surface min-h-screen bg-[#0b1217]">
      <header className="sticky top-0 z-10 border-b border-white/[0.06] bg-[#0b1217]/82 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-7">
          <Link
            href="/"
            className="flex items-center gap-2.5 text-sm font-semibold text-zinc-100"
          >
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-[#0984e3] to-[#00cec9] text-[10px] font-black text-[#0b1217]">
              D
            </span>
            Devion <span className="font-normal text-zinc-500">/ Account</span>
          </Link>
          <button
            type="button"
            aria-label="Benachrichtigungen"
            className="grid h-8 w-8 place-items-center rounded-lg text-zinc-500 transition hover:bg-white/[0.05] hover:text-zinc-200"
          >
            <Bell className="h-4 w-4" />
          </button>
        </div>
      </header>
      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-8 sm:px-7 lg:grid-cols-[190px_minmax(0,1fr)]">
        <aside className="h-fit rounded-2xl border border-white/[0.07] bg-[#172128]/80 p-2 shadow-[0_12px_32px_rgba(0,0,0,.1)]">
          <p className="px-3 pb-2 pt-2 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-600">
            Persönlich
          </p>
          <nav className="space-y-1">
            {accountNavigation.map(({ href, label, icon: Icon }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition",
                    active
                      ? "bg-gradient-to-r from-[#0984e3]/18 to-[#00cec9]/[0.07] text-zinc-50 shadow-[inset_2px_0_0_#00cec9]"
                      : "text-zinc-500 hover:bg-white/[0.05] hover:text-zinc-200",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              );
            })}
          </nav>
        </aside>
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
