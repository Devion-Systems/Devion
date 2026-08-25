import { Network } from "lucide-react";
import { CapabilityPage } from "@/components/layout/capability-page";

export default function NetworkingPage() {
  return (
    <CapabilityPage
      icon={Network}
      title="Networking"
      description="Manage domains, routes, ports, and TLS certificates."
      noticeTitle="Coming in UI-11"
      noticeDescription="The networking section (Domains, Routes, Ports, Certificates) is implemented as part of UI-11. This placeholder confirms the route is registered and navigation works."
    />
  );
}
