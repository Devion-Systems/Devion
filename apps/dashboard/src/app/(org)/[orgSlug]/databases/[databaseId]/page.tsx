import { Database } from "lucide-react";
import { CapabilityPage } from "@/components/layout/capability-page";
export default function DatabaseDetailPage() { return <CapabilityPage icon={Database} title="Datenbankübersicht" description="Status, Engine, Verbindungsdetails und Betrieb einer Managed Database." noticeTitle="Managed Databases sind noch nicht aktiviert" noticeDescription="Provisionierung bleibt deaktiviert, bis projektbezogene Ownership und eine sichere einmalige Secret-Übergabe an Node Agents definiert sind." />; }
