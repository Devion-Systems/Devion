import { ScrollText } from "lucide-react";
import { CapabilityPage } from "@/components/layout/capability-page";
export default function AuditLogPage() { return <CapabilityPage icon={ScrollText} title="Audit Log" description="Nachvollziehbare Sicherheits- und Verwaltungsereignisse deiner Organisation." noticeTitle="Audit-Ereignisse werden vorbereitet" noticeDescription="Die Ereignisquelle wird erst aktiviert, wenn alle Verwaltungsaktionen konsistent persistiert und gefiltert werden können." />; }
