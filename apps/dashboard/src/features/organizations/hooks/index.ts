"use client";

import { useQuery } from "@tanstack/react-query";
import type { Organization } from "@/features/organizations/types";
import { authClient } from "@/lib/auth-client";

export function useUserOrganizations() {
  return useQuery({
    queryKey: ["organizations"],
    queryFn: async (): Promise<Organization[]> => {
      const { data, error } = await authClient.organization.list();
      if (error)
        throw new Error(
          error.message ?? "Organisationen konnten nicht geladen werden.",
        );
      return (data ?? []).map(({ id, name, slug }) => ({ id, name, slug }));
    },
  });
}
