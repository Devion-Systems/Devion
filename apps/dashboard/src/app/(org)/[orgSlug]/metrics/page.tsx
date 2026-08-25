import { BarChart3 } from "lucide-react";
import { CapabilityPage } from "@/components/layout/capability-page";

export default function MetricsPage() {
  return (
    <CapabilityPage
      icon={BarChart3}
      title="Metrics"
      description="Platform-wide performance metrics and resource usage over time."
      noticeTitle="Backend API required"
      noticeDescription="A metrics aggregation endpoint is required before this view can show live data. See BACKEND REQUIREMENTS in the implementation plan."
    />
  );
}
