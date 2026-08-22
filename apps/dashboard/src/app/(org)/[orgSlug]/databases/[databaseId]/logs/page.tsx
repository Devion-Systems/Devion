import { ScrollText } from "lucide-react";
import { CapabilityPage } from "@/components/layout/capability-page";
export default function DatabaseLogsPage() { return <CapabilityPage icon={ScrollText} title="Datenbank-Logs" description="Verbindungsfehler, Betriebsereignisse und langsame Abfragen." noticeTitle="Keine Datenbank-Logs verfügbar" noticeDescription="Logs erscheinen erst, wenn ein Agent sie mit Quelle, Zeitstempel und Zugriffskontrolle meldet." />; }
