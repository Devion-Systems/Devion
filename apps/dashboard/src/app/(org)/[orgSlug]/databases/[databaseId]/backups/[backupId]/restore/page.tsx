import { ArchiveRestore } from "lucide-react";
import { CapabilityPage } from "@/components/layout/capability-page";
export default function DatabaseRestorePage() { return <CapabilityPage icon={ArchiveRestore} title="Backup wiederherstellen" description="Eine Datenbank aus einer verifizierten Sicherung wiederherstellen." noticeTitle="Wiederherstellung ist geschützt" noticeDescription="Diese destruktive Aktion wird erst verfügbar, wenn die Datenbank-Runtime und ein vollständiger Wiederherstellungsprozess implementiert sind." />; }
