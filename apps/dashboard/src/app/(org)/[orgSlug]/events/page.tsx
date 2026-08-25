import { Clock } from "lucide-react";
import { CapabilityPage } from "@/components/layout/capability-page";

export default function EventsPage() {
  return (
    <CapabilityPage
      icon={Clock}
      title="Events"
      description="Platform events from nodes, deployments, and infrastructure components."
      noticeTitle="Backend API required"
      noticeDescription="A platform events endpoint is required before this view can show live data. See BACKEND REQUIREMENTS in the implementation plan."
    />
  );
}
