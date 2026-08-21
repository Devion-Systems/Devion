import { CapabilityNotice } from "@/components/layout/capability-notice";
import { PageHeader } from "@/components/layout/page-header";
export default function MetricsPage() { return <div className="space-y-6 p-6"><PageHeader title="Metriken" description="Metriken werden ausschließlich aus einem verbundenen Runtime-Agenten angezeigt." /><CapabilityNotice title="Keine Runtime-Metriken verfügbar" description="Es werden keine geschätzten CPU-, RAM-, Request- oder Latenzwerte angezeigt. Verbinde einen Agenten, damit echte Zeitreihen erfasst werden können." /></div>; }
