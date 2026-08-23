import { CapabilityNotice } from "@/components/layout/capability-notice";
import { PageHeader } from "@/components/layout/page-header";
import { TerminalLogViewer } from "@/components/ui/terminal-log-viewer";

export default function DatabaseLogsPage() {
  return (
    <div className="space-y-6 p-5 sm:p-7">
      <PageHeader
        title="Datenbank-Logs"
        description="Verbindungsfehler, Betriebsereignisse und langsame Abfragen zentral untersuchen."
      />
      <CapabilityNotice
        title="Noch keine Datenbank-Logs verfügbar"
        description="Sobald ein Node-Agent Logs mit Quelle, Zeitstempel und Zugriffskontrolle meldet, erscheinen sie automatisch im Terminal."
      />
      <TerminalLogViewer
        ariaLabel="Datenbank-Logs"
        emptyMessage="Warte auf Logdaten des Datenbank-Agenten …"
        fileName="database-logs.txt"
      />
    </div>
  );
}
