import { Shield } from "lucide-react";
import { CapabilityPage } from "@/components/layout/capability-page";
export default function OrganizationSecurityPage() { return <CapabilityPage icon={Shield} title="Sicherheit" description="Organisationweite Sicherheitsrichtlinien und Anmeldeanforderungen." noticeTitle="Sicherheitsrichtlinien werden vorbereitet" noticeDescription="SSO und verpflichtende Zwei-Faktor-Authentifizierung werden erst angezeigt, wenn sie vollständig durchgesetzt werden können." />; }
