"use client";

import { Server } from "lucide-react";
import { DesignEmptyState } from "@/components/layout/design-empty-state";
import { PageHeader } from "@/components/layout/page-header";

export default function HardwarePage() {
  return (
    <div className="space-y-6 p-5 sm:p-7">
      <PageHeader
        title="Hardware"
        description="Nodes, Kapazität und Live-Zustand deiner Infrastruktur."
      />
      <DesignEmptyState
        icon={Server}
        title="Infrastruktur verbinden"
        description="Verbundene Nodes werden hier mit Health, Auslastung und laufenden Workloads angezeigt."
        detail="Verbinde einen Node, um den Hardware-Pool aufzubauen."
      />
    </div>
  );
}
