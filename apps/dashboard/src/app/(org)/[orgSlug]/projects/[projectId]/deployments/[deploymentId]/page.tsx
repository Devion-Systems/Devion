import { CapabilityNotice } from "@/components/layout/capability-notice";
import { PageHeader } from "@/components/layout/page-header";
import { TerminalLogViewer } from "@/components/ui/terminal-log-viewer";

export default function DeploymentDetailPage() {
  return (
    <div className="space-y-6 p-5 sm:p-7">
      <PageHeader
        title="Deployment"
        description="Status, Artefakte und Build-Ausgaben dieses Releases."
      />
      <CapabilityNotice
        title="Deployment noch nicht verfügbar"
        description="Commit und Status werden ergänzt, sobald der Deployment-Service reale Ereignisse speichert."
      />
      <div>
        <h2 className="mb-3 text-sm font-semibold text-zinc-200">Build-Logs</h2>
        <TerminalLogViewer
          ariaLabel="Deployment-Build-Logs"
          emptyMessage="Warte auf Build-Ausgaben des Deployment-Service …"
          fileName="deployment-build-logs.txt"
        />
      </div>
    </div>
  );
}
