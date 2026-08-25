import { Box } from "lucide-react";
import { CapabilityPage } from "@/components/layout/capability-page";

export default function BuildsPage() {
  return (
    <CapabilityPage
      icon={Box}
      title="Builds"
      description="Monitor build pipelines and view build logs."
      noticeTitle="Coming in UI-09"
      noticeDescription="The builds list and detail view are implemented as part of UI-09. This placeholder confirms the route is registered and navigation works."
    />
  );
}
