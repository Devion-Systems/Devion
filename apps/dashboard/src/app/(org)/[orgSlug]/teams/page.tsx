"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Plus, Users } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export default function TeamsPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const router = useRouter();
  const { data: teams = [], isLoading } = useQuery({
    queryKey: ["organizations", orgSlug, "teams"],
    queryFn: async () => {
      const organizations = await authClient.organization.list();
      const currentOrganization = organizations.data?.find(
        (item) => item.slug === orgSlug,
      );
      if (!currentOrganization) throw new Error("Organisation nicht gefunden");
      const { data, error } = await authClient.organization.listTeams({
        query: { organizationId: currentOrganization.id },
      });
      if (error)
        throw new Error(error.message ?? "Teams konnten nicht geladen werden.");
      return data ?? [];
    },
  });

  return (
    <div className="space-y-6 p-5 sm:p-7">
      <PageHeader
        title="Teams"
        description="Strukturiere Projekte und Mitgliedschaften in klaren Teams."
      />
      <div className="flex justify-end">
        <Button onClick={() => router.push(`/${orgSlug}/teams/new`)}>
          <Plus /> Neues Team
        </Button>
      </div>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Teams werden geladen …</p>
      ) : null}
      {!isLoading && teams.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border p-12 text-center">
          <Users className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 font-medium">Noch keine Teams</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Erstelle ein Team, um Mitglieder und Projekte zu bündeln.
          </p>
        </div>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {teams.map((team) => (
          <button
            className="group rounded-2xl border border-border bg-card p-5 text-left transition hover:border-primary/50"
            key={team.id}
            onClick={() => router.push(`/${orgSlug}/teams/${team.id}`)}
            type="button"
          >
            <Users className="size-5 text-primary" />
            <h2 className="mt-4 font-semibold">{team.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Team-Arbeitsbereich öffnen
            </p>
            <span className="mt-5 flex items-center gap-1 text-sm text-primary">
              Öffnen <ArrowRight className="size-4" />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
