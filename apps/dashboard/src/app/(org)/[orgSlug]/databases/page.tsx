"use client";

import { Database } from "lucide-react";
import { DesignEmptyState } from "@/components/layout/design-empty-state";
import { PageHeader } from "@/components/layout/page-header";

export default function DatabasesPage() {
  return (
    <div className="space-y-6 p-5 sm:p-7">
      <PageHeader
        title="Datenbanken"
        description="Verwaltete Datenbanken, Zugänge, Backups und aktuelle Auslastung."
      />
      <DesignEmptyState
        icon={Database}
        title="Noch keine Datenbanken"
        description="Deine Datenbanken erscheinen hier als übersichtliche Karten mit Engine, Status und Ressourcenverbrauch."
        detail="Erstelle eine Datenbank, sobald die Provisionierung aktiviert ist."
      />
    </div>
  );
}
