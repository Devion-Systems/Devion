"use client";

import { UserPlus } from "lucide-react";
import { DesignEmptyState } from "@/components/layout/design-empty-state";
import { PageHeader } from "@/components/layout/page-header";

export default function JoinOrganizationPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Organisation beitreten"
        description="Nutze deinen Einladungslink oder Code, um einem bestehenden Workspace beizutreten."
      />
      <DesignEmptyState
        icon={UserPlus}
        title="Einladung einlösen"
        description="Einladungen werden hier geprüft und zeigen dir vor dem Beitritt Organisation sowie Rolle an."
      />
    </div>
  );
}
