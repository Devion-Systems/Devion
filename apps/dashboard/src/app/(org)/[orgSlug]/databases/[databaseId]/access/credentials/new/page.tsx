import { KeyRound } from "lucide-react";
import { CapabilityPage } from "@/components/layout/capability-page";
export default function NewDatabaseCredentialPage() { return <CapabilityPage icon={KeyRound} title="Datenbankzugang erstellen" description="Einen eingeschränkten Zugang für ein Projekt oder einen Dienst erstellen." noticeTitle="Zugangserstellung noch nicht verfügbar" noticeDescription="Dieser Flow wird erst aktiviert, wenn die sichere Secret-Auslieferung vollständig implementiert ist." />; }
