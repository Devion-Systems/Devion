"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSession } from "@/features/auth/hooks/hooks";
import { useUserOrganizations } from "@/features/organizations/hooks";

export default function RootPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const { data: organizations, isLoading } = useUserOrganizations();

  useEffect(() => {
    if (isPending || isLoading) return;

    if (!session) {
      fetch(`${process.env.NEXT_PUBLIC_API_URL ?? ""}/api/setup/status`, {
        cache: "no-store",
      })
        .then((response) => response.json())
        .then((status) => router.replace(status.required ? "/setup" : "/login"))
        .catch(() => router.replace("/login"));
      return;
    }

    if (!organizations || organizations.length === 0) {
      router.replace("/select-organization");
      return;
    }

    router.replace(`/${organizations[0].slug}`);
  }, [session, isPending, organizations, isLoading, router]);

  return (
    <div className="flex min-h-screen items-center justify-center text-sm text-zinc-500">
      Weiterleitung …
    </div>
  );
}
