import { Plus } from "lucide-react";
import { CapabilityPage } from "@/components/layout/capability-page";
export default function NewSharedResourcePage() { return <CapabilityPage icon={Plus} title="Geteilte Ressource erstellen" description="Eine Ressource für Teams oder einzelne Mitglieder bereitstellen." noticeTitle="Erstellung noch nicht verfügbar" noticeDescription="Die Freigabe wird erst aktiviert, wenn der zugehörige Ressourcen- und Berechtigungsservice verfügbar ist." />; }
