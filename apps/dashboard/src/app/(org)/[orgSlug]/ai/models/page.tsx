import { Cpu } from "lucide-react";
import { CapabilityPage } from "@/components/layout/capability-page";

export default function AIModelsPage() {
  return (
    <CapabilityPage
      icon={Cpu}
      title="AI Models"
      description="Browse and configure available AI models from connected providers."
      noticeTitle="Coming in UI-13"
      noticeDescription="AI model management is implemented as part of UI-13. This placeholder confirms the route is registered and navigation works."
    />
  );
}
