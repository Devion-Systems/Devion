// components/layout/sidebar.tsx
"use client";

import {
  ChevronDown,
  ChevronLeft,
  LogOut,
  Settings,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { adminNavGroups, getOrgNavGroups, type NavGroup } from "@/config/nav";
import { useOptionalOrgContext } from "@/features/organizations/context/org-context";
import { filterNavGroups } from "@/features/permissions/filter-nav";
import { cn } from "@/lib/utils";
import { OrgSwitcher } from "./org-switcher";

type SidebarProps = {
  variant: "org" | "admin";
};

export function Sidebar({ variant }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const orgGroups = useOrgNavGroupsFiltered();

  const groups = variant === "admin" ? adminNavGroups : orgGroups;

  return (
    <aside
      className={cn(
        "hidden h-screen flex-col border-r border-white/[0.07] bg-[#1e272e]/95 shadow-[18px_0_60px_rgba(0,0,0,.12)] backdrop-blur-xl transition-all duration-200 md:flex",
        collapsed ? "w-16" : "w-64",
      )}
    >
      {/* Header */}
      <div className="flex h-16 items-center justify-between border-b border-white/[0.07] px-3">
        {!collapsed && variant === "org" ? (
          <OrgSwitcher />
        ) : (
          !collapsed && (
            <span className="flex items-center gap-2 px-2 text-sm font-semibold text-zinc-100">
              <span className="grid h-6 w-6 place-items-center rounded-lg bg-gradient-to-br from-[#0984e3] to-[#00cec9] text-[10px] font-black text-[#1e272e]">
                D
              </span>{" "}
              Devion Admin
            </span>
          )
        )}
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-white/[0.06] hover:text-zinc-200"
        >
          <ChevronLeft
            className={cn(
              "h-4 w-4 transition-transform",
              collapsed && "rotate-180",
            )}
          />
        </button>
      </div>

      {/* Nav Groups */}
      <nav className="flex-1 space-y-2 overflow-y-auto px-2 py-4">
        {groups.map((group) => (
          <NavGroupSection
            key={group.title}
            group={group}
            pathname={pathname}
            collapsed={collapsed}
          />
        ))}
      </nav>

      {/* Footer */}
      {!collapsed && variant === "org" && (
        <div className="mx-3 mb-3 rounded-xl border border-[#00cec9]/15 bg-[#00cec9]/[0.045] p-3">
          <div className="flex items-center gap-2 text-xs font-medium text-[#81ecec]">
            <Sparkles className="h-3.5 w-3.5" /> Devion Cloud
          </div>
          <p className="mt-1 text-[11px] leading-4 text-zinc-500">
            Deine Dienste laufen stabil.
          </p>
        </div>
      )}
      <div className="border-t border-white/[0.07] p-2">
        <Link
          href="/account/profile"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-400 transition hover:bg-white/[0.06] hover:text-zinc-200"
        >
          <Settings className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Account-Einstellungen</span>}
        </Link>
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-400 transition hover:bg-white/[0.06] hover:text-zinc-200"
          onClick={() => {
            /* signOut() */
          }}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Abmelden</span>}
        </button>
      </div>
    </aside>
  );
}

function NavGroupSection({
  group,
  pathname,
  collapsed,
}: {
  group: NavGroup;
  pathname: string;
  collapsed: boolean;
}) {
  const hasActiveItem = group.items.some(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
  const [open, setOpen] = useState(group.defaultOpen ?? hasActiveItem);

  if (collapsed) {
    // Im collapsed-State: nur Icons, keine Gruppierung nötig
    return (
      <div className="space-y-1">
        {group.items.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} collapsed />
        ))}
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-600 transition hover:text-zinc-300"
      >
        <span>{group.title}</span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <div className="mt-0.5 space-y-0.5">
          {group.items.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              pathname={pathname}
              collapsed={false}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function NavLink({
  item,
  pathname,
  collapsed,
}: {
  item: NavGroup["items"][number];
  pathname: string;
  collapsed: boolean;
}) {
  // `/admin/system` is a landing page, not a parent navigation entry. Keep
  // it inactive for deeper system routes such as `/admin/system/updates`.
  const isActive = pathname === item.href ||
    (pathname.startsWith(`${item.href}/`) && item.href !== "/admin/system");
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all",
        isActive
          ? "bg-gradient-to-r from-[#0984e3]/18 to-[#00cec9]/[0.07] text-zinc-50 shadow-[inset_2px_0_0_#00cec9]"
          : "text-zinc-500 hover:bg-white/[0.05] hover:text-zinc-200",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed && <span className="truncate">{item.label}</span>}
      {isActive && !collapsed && (
        <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#00cec9] shadow-[0_0_10px_rgba(0,206,201,.8)]" />
      )}
    </Link>
  );
}

// kleiner Helper, damit der org-Context Hook nicht bedingt aufgerufen wird (Rules of Hooks)
function useOrgNavGroupsFiltered(): NavGroup[] {
  const context = useOptionalOrgContext();

  if (!context) {
    return [];
  }

  const groups = getOrgNavGroups(context.org.slug);
  return filterNavGroups(groups, context.membership);
}
