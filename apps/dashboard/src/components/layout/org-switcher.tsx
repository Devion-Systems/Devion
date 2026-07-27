// components/layout/org-switcher.tsx
"use client";

import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useOrgContext } from "@/features/organizations/context/org-context";
import { useUserOrganizations } from "@/features/organizations/hooks";

export function OrgSwitcher() {
  const router = useRouter();
  const { org } = useOrgContext();
  const { data: organizations } = useUserOrganizations();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-md px-2 py-2 text-sm text-zinc-200 hover:bg-zinc-900"
        >
          <span className="truncate font-medium">{org.name}</span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-zinc-500" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {organizations?.map((o) => (
          <DropdownMenuItem
            key={o.id}
            onClick={() => router.push(`/${o.slug}`)}
            className="flex items-center justify-between"
          >
            <span className="truncate">{o.name}</span>
            {o.slug === org.slug && <Check className="h-4 w-4" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push("/create-organization")}>
          <Plus className="mr-2 h-4 w-4" />
          Neue Organisation
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
