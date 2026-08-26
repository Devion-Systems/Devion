"use client";

import { LogOut, Settings, User } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authClient } from "@/lib/auth-client";
import { type Locale, useI18n } from "@/lib/i18n";

type UserMenuProps = {
  /** First letter(s) shown in the avatar. */
  initials?: string;
  /** Display name shown in the dropdown. */
  name?: string;
  /** Email shown in the dropdown. */
  email?: string;
};

export function UserMenu({ initials = "?", name, email }: UserMenuProps) {
  const [signingOut, setSigningOut] = useState(false);
  const { locale, setLocale, t } = useI18n();

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await authClient.signOut();
      window.location.assign("/login");
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="User menu"
          className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-[#0984e3] to-[#00cec9] text-[11px] font-bold text-[#0b1217] transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#81ecec]"
        >
          {initials.slice(0, 2).toUpperCase()}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        {(name || email) && (
          <>
            <div className="px-2 py-1.5">
              {name && (
                <p className="truncate text-sm font-medium text-zinc-100">
                  {name}
                </p>
              )}
              {email && (
                <p className="truncate text-xs text-zinc-500">{email}</p>
              )}
            </div>
            <DropdownMenuSeparator />
          </>
        )}

        <div className="px-2 py-1.5">
          <label
            className="block text-xs text-zinc-500"
            htmlFor="locale-switcher"
          >
            {t("common.language")}
          </label>
          <select
            id="locale-switcher"
            value={locale}
            onChange={(event) => setLocale(event.target.value as Locale)}
            className="mt-1 w-full rounded-md border border-white/[0.1] bg-zinc-900 px-2 py-1 text-xs text-zinc-200"
          >
            <option value="de">{t("common.german")}</option>
            <option value="en">{t("common.english")}</option>
          </select>
        </div>
        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link href="/account">
            <User className="size-4" aria-hidden="true" />
            {t("userMenu.settings")}
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem asChild>
          <Link href="/account/security">
            <Settings className="size-4" aria-hidden="true" />
            {t("userMenu.security")}
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={() => void handleSignOut()}
          disabled={signingOut}
          className="text-red-400 focus:text-red-300"
        >
          <LogOut className="size-4" aria-hidden="true" />
          {signingOut ? t("userMenu.signingOut") : t("userMenu.signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
