import { ArchiveRestore } from "lucide-react";
import { CapabilityPage } from "@/components/layout/capability-page";
export default function DatabaseBackupsPage() { return <CapabilityPage icon={ArchiveRestore} title="Backups" description="Sicherungen, Wiederherstellung und Aufbewahrung dieser Datenbank." noticeTitle="Backups noch nicht verfügbar" noticeDescription="Backups werden erst aktiviert, wenn die Managed-Database-Runtime über Node Agents bereitsteht." />; }
