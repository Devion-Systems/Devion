"use client";

import { UserRound } from "lucide-react";
import { DesignEmptyState } from "@/components/layout/design-empty-state";
import { PageHeader } from "@/components/layout/page-header";

export default function AccountProfilePage() {
  return (
    <div className="space-y-6 py-1">
      <PageHeader
        title="Profil"
        description="Persönliche Angaben, Avatar und primäre E-Mail-Adresse."
      />
      <DesignEmptyState
        icon={UserRound}
        title="Dein Profil ist bereit"
        description="Sobald das Profilformular angebunden ist, verwaltest du hier Name, Avatar und Kontaktadresse."
      />
    </div>
  );
}
