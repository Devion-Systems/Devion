"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = [
  { suffix: "", label: "Übersicht" },
  { suffix: "/members", label: "Mitglieder" },
  { suffix: "/projects", label: "Projekte" },
  { suffix: "/settings", label: "Einstellungen" },
];

export default function TeamsDetailLayout({ children }: { children: React.ReactNode }) {
  const { orgSlug, teamSlug } = useParams<{ orgSlug: string; teamSlug: string }>();
  const pathname = usePathname();
  const base = `/${orgSlug}/teams/${teamSlug}`;

  return <div>
    <nav aria-label="Teamnavigation" className="sticky top-16 z-[1] overflow-x-auto border-b border-white/[0.06] bg-[#0b1217]/80 px-5 backdrop-blur-xl sm:px-7">
      <div className="mx-auto flex w-full max-w-[1600px] gap-1">
        {tabs.map((tab) => {
          const href = `${base}${tab.suffix}`;
          const active = pathname === href;
          return <Link key={tab.label} href={href} className={cn("whitespace-nowrap border-b-2 px-3 py-3 text-sm transition", active ? "border-[#00cec9] text-[#81ecec]" : "border-transparent text-zinc-500 hover:text-zinc-200")}>{tab.label}</Link>;
        })}
      </div>
    </nav>
    {children}
  </div>;
}
