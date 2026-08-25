import { Zap } from "lucide-react";
import { CapabilityPage } from "@/components/layout/capability-page";

export default function DeploymentsPage() {
  return (
    <CapabilityPage
      icon={Zap}
      title="Deployments"
      description="View and manage all deployments across your applications."
      noticeTitle="Coming in UI-07"
      noticeDescription="The deployments list and detail view are implemented as part of UI-07. This placeholder confirms the route is registered and navigation works."
    />
  );
}
