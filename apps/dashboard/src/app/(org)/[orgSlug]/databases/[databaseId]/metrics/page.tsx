import { ChartNoAxesCombined } from "lucide-react";
import { CapabilityPage } from "@/components/layout/capability-page";
export default function DatabaseMetricsPage() { return <CapabilityPage icon={ChartNoAxesCombined} title="Datenbankmetriken" description="Verbindungen, Speicherverbrauch und Query-Performance." noticeTitle="Keine Datenbankmetriken verfügbar" noticeDescription="Metriken werden erst angezeigt, wenn die Managed-Database-Runtime echte Zeitreihen liefert." />; }
