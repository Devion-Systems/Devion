import { ScrollText } from "lucide-react";
import { CapabilityPage } from "@/components/layout/capability-page";

export default function LogsPage() {
  return (
    <CapabilityPage
      icon={ScrollText}
      title="Logs"
      description="Centralized log viewer across all projects, applications, and nodes."
      noticeTitle="Coming in UI-10"
      noticeDescription="The central log viewer (with filtering, live-tailing, and search) is implemented as part of UI-10. This placeholder confirms the route is registered and navigation works."
    />
  );
}
