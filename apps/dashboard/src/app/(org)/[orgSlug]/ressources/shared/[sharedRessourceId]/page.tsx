import { redirect } from "next/navigation";
export default async function LegacySharedDetailPage({ params }: { params: Promise<{ orgSlug: string; sharedRessourceId: string }> }) { const { orgSlug, sharedRessourceId } = await params; redirect(`/${orgSlug}/resources/shared/${sharedRessourceId}`); }
