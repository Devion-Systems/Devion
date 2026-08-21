import { CapabilityNotice } from "@/components/layout/capability-notice";
import { PageHeader } from "@/components/layout/page-header";
export default function EnvironmentDetailPage() { return <div className="space-y-6 p-6"><PageHeader title="Umgebung" description="Konfiguration und Runtime-Zustand einer Projektumgebung." /><CapabilityNotice title="Runtime-Status noch nicht verbunden" description="Variablen werden bereits persistent verwaltet. Deployment-, Uptime- und Domain-Status erscheinen erst mit echten Agent-Daten." /></div>; }
