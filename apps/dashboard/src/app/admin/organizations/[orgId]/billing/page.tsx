import { ReceiptText } from "lucide-react";
import { CapabilityPage } from "@/components/layout/capability-page";
export default function OrganizationBillingPage() { return <CapabilityPage icon={ReceiptText} title="Abrechnung" description="Plan, Nutzung und Zahlungsstatus einer Organisation." noticeTitle="Abrechnung wird vorbereitet" noticeDescription="Abrechnungsdaten erscheinen erst, wenn ein angebundener Provider verlässliche Daten liefert." />; }
