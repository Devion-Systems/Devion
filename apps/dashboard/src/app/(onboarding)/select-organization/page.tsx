"use client";

import { Building2 } from "lucide-react";
import { DesignEmptyState } from "@/components/layout/design-empty-state";
import { PageHeader } from "@/components/layout/page-header";

export default function SelectOrganizationPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Organisation wählen"
        description="Wähle den Workspace, in dem du heute arbeiten möchtest."
      />
      <DesignEmptyState
        icon={Building2}
        title="Deine Workspaces"
        description="Deine Organisationen werden hier als schnelle, visuell klare Auswahl angezeigt."
      />
    </div>
  );
}
