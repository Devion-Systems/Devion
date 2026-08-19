import { redirect } from "next/navigation";

/** Keeps existing links to the former misspelled route working. */
export default function LegacySelectOrganizationPage() {
  redirect("/select-organization");
}
