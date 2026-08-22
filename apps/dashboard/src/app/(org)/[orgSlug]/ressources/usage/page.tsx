import { redirect } from "next/navigation";
export default async function LegacyUsagePage({ params }: { params: Promise<{ orgSlug: string }> }) { const { orgSlug } = await params; redirect(`/${orgSlug}/resources/usage`); }
