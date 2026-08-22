import { redirect } from "next/navigation";
export default async function LegacyLimitsPage({ params }: { params: Promise<{ orgSlug: string }> }) { const { orgSlug } = await params; redirect(`/${orgSlug}/resources/limits`); }
