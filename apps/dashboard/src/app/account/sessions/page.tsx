"use client";

import { Laptop } from "lucide-react";
import { DesignEmptyState } from "@/components/layout/design-empty-state";
import { PageHeader } from "@/components/layout/page-header";

export default function AccountSessionsPage() {
  return (
    <div className="space-y-6 py-1">
      <PageHeader
        title="Aktive Sitzungen"
        description="Überprüfe Geräte und beende Sitzungen, die du nicht mehr benötigst."
      />
      <DesignEmptyState
        icon={Laptop}
        title="Keine Sitzungen geladen"
        description="Deine aktiven Geräte und Browser-Sitzungen werden hier übersichtlich dargestellt."
      />
    </div>
  );
}
