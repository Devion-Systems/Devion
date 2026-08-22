import { redirect } from "next/navigation";
export default async function LegacySharedPage({ params }: { params: Promise<{ orgSlug: string }> }) { const { orgSlug } = await params; redirect(`/${orgSlug}/resources/shared`); }
