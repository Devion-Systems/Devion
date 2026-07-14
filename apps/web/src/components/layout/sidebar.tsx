// components/layout/sidebar.tsx
"use client";

import { ChevronDown, ChevronLeft, LogOut, Settings } from "lucide-react";
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
        "flex h-screen flex-col border-r border-zinc-800 bg-zinc-950 transition-all duration-200",
        collapsed ? "w-16" : "w-64",
      )}
    >
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b border-zinc-800 px-3">
        {!collapsed && variant === "org" ? (
          <OrgSwitcher />
        ) : (
          !collapsed && (
            <span className="px-2 text-sm font-semibold text-zinc-100">
              Devion Admin
            </span>
          )
        )}
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-900 hover:text-zinc-200"
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
      <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-3">
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
      <div className="border-t border-zinc-800 p-2">
        <Link
          href="/account/profile"
          className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
        >
          <Settings className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Account-Einstellungen</span>}
        </Link>
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
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
        className="flex w-full items-center justify-between rounded-md px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-zinc-500 hover:text-zinc-300"
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
  const isActive =
    pathname === item.href || pathname.startsWith(`${item.href}/`);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
        isActive
          ? "bg-zinc-900 text-zinc-100"
          : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!collapsed && <span className="truncate">{item.label}</span>}
      {isActive && !collapsed && (
        <span className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-500" />
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
