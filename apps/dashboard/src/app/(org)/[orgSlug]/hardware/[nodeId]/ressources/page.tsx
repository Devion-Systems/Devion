import { redirect } from "next/navigation";
export default async function LegacyNodeResourcesPage({ params }: { params: Promise<{ orgSlug: string; nodeId: string }> }) { const { orgSlug, nodeId } = await params; redirect(`/${orgSlug}/hardware/${nodeId}/resources`); }
