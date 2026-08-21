"use client";

import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Sidebar } from "@/components/layout/sidebar";
import { OrgProvider } from "@/features/organizations/context/org-context";
import type { Membership, Organization } from "@/features/organizations/types";

type OrgWithMembership = {
  org: Organization;
  membership: Membership;
};

function useOrgBySlug(slug: string) {
  return useQuery<OrgWithMembership>({
    queryKey: ["orgs", slug],
    queryFn: async () => {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "";
      const res = await fetch(`${baseUrl}/organizations/${slug}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Organisation nicht gefunden");
      return res.json();
    },
    enabled: !!slug,
  });
}

export default function OrgLayout({ children }: { children: React.ReactNode }) {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const router = useRouter();
  const { data, isLoading, isError } = useOrgBySlug(orgSlug);

  useEffect(() => {
    if (isError) router.replace("/select-organization");
  }, [isError, router]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#11191f]">
        <div className="flex items-center gap-3 text-sm text-zinc-500">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-700 border-t-[#0984e3]" />
          Lade Organisation …
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <OrgProvider org={data.org} membership={data.membership}>
      <div className="flex h-screen overflow-hidden bg-[#0b1217]">
        <Sidebar variant="org" />
        <main className="app-surface flex min-w-0 flex-1 flex-col overflow-y-auto">
          <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center justify-between border-b border-white/[0.06] bg-[#0b1217]/82 px-5 backdrop-blur-xl sm:px-7">
            <div className="flex items-center gap-3 text-xs text-zinc-500">
              <MobileNav variant="org" />
              <span className="devion-status-dot h-2 w-2 rounded-full bg-[#00cec9]" />
              <span className="hidden sm:inline">
                Alle Systeme betriebsbereit
              </span>
              <span className="sm:hidden">Systeme online</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="hidden h-8 items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 text-xs text-zinc-500 transition hover:border-white/[0.12] hover:text-zinc-300 md:flex"
              >
                <Search className="h-3.5 w-3.5" />
                Suchen
                <kbd className="ml-5 rounded border border-white/[0.08] px-1.5 py-0.5 font-mono text-[10px] text-zinc-600">
                  ⌘ K
                </kbd>
              </button>
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-[#0984e3] to-[#00cec9] text-[11px] font-bold text-[#0b1217]">
                D
              </div>
            </div>
          </header>
          <div className="mx-auto w-full max-w-[1600px] flex-1">{children}</div>
        </main>
      </div>
    </OrgProvider>
  );
}
