import { redirect } from "next/navigation";

/**
 * Redirect /[orgSlug]/ai → /[orgSlug]/ai/providers
 */
export default function AIPage({
  params,
}: {
  params: { orgSlug: string };
}) {
  redirect(`/${params.orgSlug}/ai/providers`);
}
