import { CapabilityNotice } from "@/components/layout/capability-notice";
import { PageHeader } from "@/components/layout/page-header";
export default function DeploymentDetailPage() { return <div className="space-y-6 p-6"><PageHeader title="Deployment" description="Detaildaten eines tatsächlich ausgeführten Releases." /><CapabilityNotice title="Deployment nicht verfügbar" description="Build-Logs, Commit und Status werden nicht simuliert. Diese Ansicht wird aktiviert, sobald ein Deployment-Service reale Ereignisse speichert." /></div>; }
