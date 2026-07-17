import { useQuery } from "@tanstack/react-query";

import { apiRequest } from "@/lib/api-client";

export function useProjects(orgId: string) {
  return useQuery({
    queryKey: ["orgs", orgId, "projects"],
    queryFn: () =>
      apiRequest(`/api/orgs/${encodeURIComponent(orgId)}/projects`),
    enabled: Boolean(orgId),
  });
}
