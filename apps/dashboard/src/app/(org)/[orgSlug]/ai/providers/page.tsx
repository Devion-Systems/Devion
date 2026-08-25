import { Brain } from "lucide-react";
import { CapabilityPage } from "@/components/layout/capability-page";

export default function AIProvidersPage() {
  return (
    <CapabilityPage
      icon={Brain}
      title="AI Providers"
      description="Connect and manage AI inference providers (OpenAI, Anthropic, OpenAI-compatible, and local models)."
      noticeTitle="Coming in UI-13"
      noticeDescription="AI provider management (including credential handling and model discovery) is implemented as part of UI-13. This placeholder confirms the route is registered and navigation works."
    />
  );
}
