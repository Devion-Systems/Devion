import { CapabilityNotice } from "@/components/layout/capability-notice";
import { PageHeader } from "@/components/layout/page-header";
export default function ProjectLogsPage() { return <div className="space-y-6 p-6"><PageHeader title="Logs" description="Runtime-Logs eines verbundenen Deployments." /><CapabilityNotice title="Keine Runtime-Logs verfügbar" description="Beispiel-Logs werden nicht mehr angezeigt. Sobald ein Deployment-Agent Logs liefert, erscheinen sie hier mit Quelle und Zeitstempel." /></div>; }
