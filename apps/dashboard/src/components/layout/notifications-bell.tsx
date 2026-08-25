"use client";

import { Bell } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Notifications entry point in the topbar.
 *
 * BACKEND REQUIREMENT: A notifications API endpoint is needed to fetch
 * unread notification count and notification list.
 * Endpoint suggestion: GET /organizations/:orgSlug/notifications
 * Response: { unreadCount: number; items: Notification[] }
 *
 * Until the API exists, this component renders the entry point as a
 * shell (no fake data shown).
 */
export function NotificationsBell() {
  // TODO: Wire to GET /organizations/:orgSlug/notifications once API exists
  const unreadCount = 0;
  const hasUnread = unreadCount > 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={
            hasUnread
              ? `Notifications (${unreadCount} unread)`
              : "Notifications"
          }
          className="relative grid h-8 w-8 place-items-center rounded-lg text-zinc-500 transition hover:bg-white/[0.06] hover:text-zinc-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#81ecec]"
        >
          <Bell className="size-4" aria-hidden="true" />
          {hasUnread && (
            <span
              aria-hidden="true"
              className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#0984e3]"
            />
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between border-b border-white/[0.08] px-3 py-2">
          <span className="text-sm font-medium text-zinc-100">
            Notifications
          </span>
        </div>
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <Bell className="mb-2 size-6 text-zinc-600" aria-hidden="true" />
          <p className="text-sm text-zinc-500">No notifications</p>
          <p className="mt-0.5 text-xs text-zinc-600">
            You're all caught up.
          </p>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
