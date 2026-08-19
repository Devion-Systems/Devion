// features/auth/hooks.ts
import { useQuery } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";

export function useSession() {
  return useQuery({
    queryKey: ["auth", "session"],
    queryFn: async () => {
      const { data, error } = await authClient.getSession();
      if (error) return null;
      return data;
    },
  });
}
