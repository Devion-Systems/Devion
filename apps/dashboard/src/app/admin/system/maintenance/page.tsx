import { Wrench } from "lucide-react";
import { CapabilityPage } from "@/components/layout/capability-page";
export default function MaintenancePage() { return <CapabilityPage icon={Wrench} title="Wartungsfenster" description="Geplante Wartungen erstellen und transparent ankündigen." noticeTitle="Wartungsplanung wird vorbereitet" noticeDescription="Wartungsfenster werden erst aktiviert, wenn Benachrichtigungen und Audit-Protokollierung bereitstehen." />; }
