"use client";

import { useQuery } from "@tanstack/react-query";
import type { Organization } from "@/features/organizations/types";

export function useUserOrganizations() {
  return useQuery({
    queryKey: ["organizations"],
    queryFn: async (): Promise<Organization[]> => {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "";
      const response = await fetch(`${baseUrl}/organizations`, {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Organisationen konnten nicht geladen werden.");
      }

      const data: Organization[] | { organizations: Organization[] } =
        await response.json();
      return Array.isArray(data) ? data : data.organizations;
    },
  });
}
