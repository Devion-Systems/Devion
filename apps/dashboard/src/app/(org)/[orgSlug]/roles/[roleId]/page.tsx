import { ShieldCheck } from "lucide-react";
import { CapabilityPage } from "@/components/layout/capability-page";
export default function RoleDetailPage() { return <CapabilityPage icon={ShieldCheck} title="Rolle" description="Berechtigungen einer organisationsweiten Rolle prüfen und verwalten." noticeTitle="Berechtigungseditor wird vorbereitet" noticeDescription="Rollen werden erst editierbar, wenn die vollständige Berechtigungsmatrix serverseitig durchgesetzt wird." />; }
