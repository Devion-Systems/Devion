import { CapabilityNotice } from "@/components/layout/capability-notice";
import { PageHeader } from "@/components/layout/page-header";
import { TerminalLogViewer } from "@/components/ui/terminal-log-viewer";

export default function ProjectLogsPage() {
  return (
    <div className="space-y-6 p-5 sm:p-7">
      <PageHeader
        title="Runtime-Logs"
        description="Ausgaben aller verbundenen Deployments durchsuchen und exportieren."
      />
      <CapabilityNotice
        title="Noch keine Runtime-Logs verfügbar"
        description="Sobald ein Deployment-Agent echte Ausgaben liefert, werden sie hier mit Quelle und Zeitstempel dargestellt."
      />
      <TerminalLogViewer
        ariaLabel="Projekt-Runtime-Logs"
        emptyMessage="Warte auf Logdaten eines Deployment-Agenten …"
        fileName="runtime-logs.txt"
      />
    </div>
  );
}
