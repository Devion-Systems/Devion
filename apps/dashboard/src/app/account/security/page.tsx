"use client";

import { LockKeyhole } from "lucide-react";
import { DesignEmptyState } from "@/components/layout/design-empty-state";
import { PageHeader } from "@/components/layout/page-header";

export default function AccountSecurityPage() {
  return (
    <div className="space-y-6 py-1">
      <PageHeader
        title="Sicherheit"
        description="Passwort, Zwei-Faktor-Authentifizierung und Zugriffsrichtlinien."
      />
      <DesignEmptyState
        icon={LockKeyhole}
        title="Schutz für dein Konto"
        description="Aktiviere hier zusätzliche Schutzmechanismen und überprüfe deine Anmelderichtlinien."
      />
    </div>
  );
}
