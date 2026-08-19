"use client";

import { BellRing } from "lucide-react";
import { DesignEmptyState } from "@/components/layout/design-empty-state";
import { PageHeader } from "@/components/layout/page-header";

export default function AccountNotificationsPage() {
  return (
    <div className="space-y-6 py-1">
      <PageHeader
        title="Benachrichtigungen"
        description="Lege fest, über welche wichtigen Ereignisse du informiert werden möchtest."
      />
      <DesignEmptyState
        icon={BellRing}
        title="Deine Benachrichtigungen"
        description="E-Mail- und Push-Präferenzen werden hier in klaren, thematischen Gruppen verwaltet."
      />
    </div>
  );
}
