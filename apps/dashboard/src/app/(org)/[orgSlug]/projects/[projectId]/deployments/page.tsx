import { CapabilityNotice } from "@/components/layout/capability-notice";
import { PageHeader } from "@/components/layout/page-header";
export default function DeploymentsPage() { return <div className="space-y-6 p-6"><PageHeader title="Deployments" description="Tatsächlich ausgeführte Releases dieses Projekts." /><CapabilityNotice title="Deployment-Runtime wird vorbereitet" description="Es werden keine erfundenen Build-Historien angezeigt. Nach Anbindung des Deployment-Service werden hier nur dessen nachvollziehbare Ereignisse und Logs dargestellt." /></div>; }
