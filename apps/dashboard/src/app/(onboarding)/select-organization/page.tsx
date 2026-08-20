"use client";

import { Building2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { DesignEmptyState } from "@/components/layout/design-empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { useUserOrganizations } from "@/features/organizations/hooks";

export default function SelectOrganizationPage() {
  const router = useRouter();
  const { data: organizations, isLoading } = useUserOrganizations();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Organisation wählen"
        description="Wähle den Workspace, in dem du heute arbeiten möchtest."
      />
      {isLoading ? (
        <p className="text-sm text-muted-foreground">
          Organisationen werden geladen …
        </p>
      ) : organizations?.length ? (
        <div className="grid max-w-3xl gap-3 sm:grid-cols-2">
          {organizations.map((organization) => (
            <button
              key={organization.id}
              type="button"
              onClick={() => router.push(`/${organization.slug}`)}
              className="rounded-2xl border border-border bg-card p-5 text-left transition hover:border-primary/50 hover:bg-muted/50"
            >
              <Building2 className="mb-4 size-5 text-primary" />
              <p className="font-semibold">{organization.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                /{organization.slug}
              </p>
            </button>
          ))}
        </div>
      ) : (
        <DesignEmptyState
          icon={Building2}
          title="Noch keine Organisation"
          description="Erstelle zuerst einen Workspace für deine Projekte und dein Team."
        />
      )}
    </div>
  );
}
