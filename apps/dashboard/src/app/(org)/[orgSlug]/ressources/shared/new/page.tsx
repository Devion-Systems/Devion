import { redirect } from "next/navigation";
export default async function LegacyNewSharedPage({ params }: { params: Promise<{ orgSlug: string }> }) { const { orgSlug } = await params; redirect(`/${orgSlug}/resources/shared/new`); }
