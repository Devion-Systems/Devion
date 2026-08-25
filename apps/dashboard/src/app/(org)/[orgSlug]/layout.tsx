"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { GlobalSearch } from "@/components/layout/global-search";
import { MobileNav } from "@/components/layout/mobile-nav";
import { NotificationsBell } from "@/components/layout/notifications-bell";
import { Sidebar } from "@/components/layout/sidebar";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";
import { OrgProvider } from "@/features/organizations/context/org-context";
import type { Membership, Organization } from "@/features/organizations/types";
import { authClient } from "@/lib/auth-client";

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

function useCurrentUser() {
  return useQuery({
    queryKey: ["auth", "session"],
    queryFn: async () => {
      const { data } = await authClient.getSession();
      return data?.user ?? null;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export default function OrgLayout({ children }: { children: React.ReactNode }) {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const router = useRouter();
  const { data, isLoading, isError } = useOrgBySlug(orgSlug);
  const { data: user } = useCurrentUser();

  useEffect(() => {
    if (isError) router.replace("/select-organization");
  }, [isError, router]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0b1217]">
        <div className="flex items-center gap-3 text-sm text-zinc-500">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-700 border-t-[#0984e3]" />
          Loading organization…
        </div>
      </div>
    );
  }

  if (!data) return null;

  // Derive initials from user name or email
  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
    : user?.email?.[0] ?? "?";

  return (
    <OrgProvider org={data.org} membership={data.membership}>
      <div className="flex h-screen overflow-hidden bg-[#0b1217]">
        {/* Permanent sidebar (desktop) */}
        <Sidebar variant="org" />

        {/* Main content area */}
        <main className="app-surface flex min-w-0 flex-1 flex-col overflow-y-auto">
          {/* ── Topbar ─────────────────────────────────────────────────── */}
          <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center justify-between border-b border-white/[0.06] bg-[#0b1217]/82 px-4 backdrop-blur-xl sm:px-6">
            {/* Left: mobile hamburger + system status indicator */}
            <div className="flex items-center gap-3">
              <MobileNav variant="org" />
              <span className="hidden items-center gap-2 text-xs text-zinc-500 sm:flex">
                <span className="devion-status-dot h-1.5 w-1.5 rounded-full bg-[#00cec9]" />
                All systems operational
              </span>
            </div>

            {/* Right: search, notifications, theme toggle, user menu */}
            <div className="flex items-center gap-1.5">
              <GlobalSearch />
              <NotificationsBell />
              <ThemeToggle />
              {/* Divider */}
              <span
                aria-hidden="true"
                className="mx-1 h-5 w-px bg-white/[0.08]"
              />
              <UserMenu
                initials={initials}
                name={user?.name ?? undefined}
                email={user?.email ?? undefined}
              />
            </div>
          </header>

          {/* ── Page content ───────────────────────────────────────────── */}
          <div className="mx-auto w-full max-w-[1440px] flex-1 px-4 sm:px-6">
            {children}
          </div>
        </main>
      </div>
    </OrgProvider>
  );
}
