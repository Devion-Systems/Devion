import { TriangleAlert } from "lucide-react";
import { CapabilityPage } from "@/components/layout/capability-page";
export default function OrganizationDangerZonePage() { return <CapabilityPage icon={TriangleAlert} title="Gefahrenbereich" description="Kritische Organisationsaktionen mit nachvollziehbarer Bestätigung." noticeTitle="Organisationslöschung ist geschützt" noticeDescription="Ownership-Übergabe und Löschung werden erst freigeschaltet, wenn der vollständige Audit- und Wiederherstellungsprozess bereitsteht." />; }
