import { HardDrive } from "lucide-react";
import { CapabilityPage } from "@/components/layout/capability-page";

export default function StoragePage() {
  return (
    <CapabilityPage
      icon={HardDrive}
      title="Storage"
      description="Manage persistent volumes and object storage buckets."
      noticeTitle="Coming in UI-12"
      noticeDescription="The storage section (Volumes, Object Storage) is implemented as part of UI-12. This placeholder confirms the route is registered and navigation works."
    />
  );
}
