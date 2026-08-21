"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = [
  { key: "general", label: "Allgemein" },
  { key: "security", label: "Sicherheit" },
  { key: "integrations", label: "Integrationen" },
  { key: "danger-zone", label: "Gefahrenzone" },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const pathname = usePathname();
  const base = `/${orgSlug}/settings`;

  return <div>
    <nav aria-label="Organisationseinstellungen" className="sticky top-16 z-[1] overflow-x-auto border-b border-white/[0.06] bg-[#0b1217]/80 px-5 backdrop-blur-xl sm:px-7">
      <div className="mx-auto flex w-full max-w-[1600px] gap-1">
        {tabs.map((tab) => {
          const href = `${base}/${tab.key}`;
          const active = pathname === href;
          return <Link key={tab.key} href={href} className={cn("whitespace-nowrap border-b-2 px-3 py-3 text-sm transition", active ? "border-[#00cec9] text-[#81ecec]" : "border-transparent text-zinc-500 hover:text-zinc-200")}>{tab.label}</Link>;
        })}
      </div>
    </nav>
    {children}
  </div>;
}
