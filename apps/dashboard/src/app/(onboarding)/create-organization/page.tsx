"use client";

import { Building2 } from "lucide-react";
import { DesignEmptyState } from "@/components/layout/design-empty-state";
import { PageHeader } from "@/components/layout/page-header";

export default function CreateOrganizationPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Organisation erstellen"
        description="Lege den gemeinsamen Bereich für Projekte, Teams und Infrastruktur an."
      />
      <DesignEmptyState
        icon={Building2}
        title="Deine neue Organisation"
        description="Der Einrichtungsassistent führt dich durch Name, Slug und erste Zugriffsoptionen."
        detail="Nach der Einrichtung landest du direkt in deinem Control Center."
      />
    </div>
  );
}
