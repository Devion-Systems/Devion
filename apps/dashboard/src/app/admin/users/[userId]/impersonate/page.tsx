import { UserRoundCog } from "lucide-react";
import { CapabilityPage } from "@/components/layout/capability-page";
export default function ImpersonatePage() { return <CapabilityPage icon={UserRoundCog} title="Nutzeransicht" description="Eine Support-Sitzung unter strenger Audit-Kontrolle starten." noticeTitle="Impersonierung ist geschützt" noticeDescription="Diese Funktion wird erst aktiviert, wenn jede Sitzung mit Anlass, Zeitraum und Audit-Ereignis vollständig nachvollziehbar ist." />; }
