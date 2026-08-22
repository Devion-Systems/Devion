import { KeyRound } from "lucide-react";
import { CapabilityPage } from "@/components/layout/capability-page";
export default function DatabaseAccessPage() { return <CapabilityPage icon={KeyRound} title="Datenbankzugriff" description="Verbundene Projekte und Zugangsdaten dieser Datenbank." noticeTitle="Zugänge noch nicht verfügbar" noticeDescription="Zugangsdaten werden erst angeboten, wenn sie sicher und einmalig an den passenden Node Agent übergeben werden können." />; }
