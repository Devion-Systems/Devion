"use client";

import { Users } from "lucide-react";
import { DesignEmptyState } from "@/components/layout/design-empty-state";
import { PageHeader } from "@/components/layout/page-header";

export default function TeamsPage() {
  return (
    <div className="space-y-6 p-5 sm:p-7">
      <PageHeader
        title="Teams"
        description="Strukturiere Projekte und Mitgliedschaften in klaren Teams."
      />
      <DesignEmptyState
        icon={Users}
        title="Teams entstehen hier"
        description="Team-Karten bündeln Mitglieder, Projekte und ihre wichtigsten Aktivitäten in einer kompakten Übersicht."
      />
    </div>
  );
}
