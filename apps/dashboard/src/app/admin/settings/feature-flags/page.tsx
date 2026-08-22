import { Flag } from "lucide-react";
import { CapabilityPage } from "@/components/layout/capability-page";
export default function FeatureFlagsPage() { return <CapabilityPage icon={Flag} title="Feature Flags" description="Funktionen kontrolliert für Organisationen aktivieren." noticeTitle="Feature-Flag-Verwaltung wird vorbereitet" noticeDescription="Flags werden erst editierbar, wenn Rollout und Audit-Log serverseitig durchgesetzt werden." />; }
