"use client";

import { UsersRound } from "lucide-react";
import { DesignEmptyState } from "@/components/layout/design-empty-state";
import { PageHeader } from "@/components/layout/page-header";

export default function MembersPage() {
  return (
    <div className="space-y-6 p-5 sm:p-7">
      <PageHeader
        title="Mitglieder"
        description="Mitglieder, Rollen und Zugriffsrechte in deiner Organisation."
      />
      <DesignEmptyState
        icon={UsersRound}
        title="Team-Mitglieder verwalten"
        description="Die Mitgliederliste zeigt Rolle, Status und die wichtigsten Berechtigungen auf einen Blick."
      />
    </div>
  );
}
