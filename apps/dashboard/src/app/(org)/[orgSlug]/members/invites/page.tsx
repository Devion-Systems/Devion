"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, X } from "lucide-react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export default function MembersInvitesPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const queryClient = useQueryClient();
  const { data: state, isLoading } = useQuery({
    queryKey: ["organization", orgSlug, "invitations"],
    queryFn: async () => {
      const organizations = await authClient.organization.list();
      const organization = organizations.data?.find(
        (item) => item.slug === orgSlug,
      );
      if (!organization) throw new Error("Organisation nicht gefunden.");
      const { data, error } = await authClient.organization.listInvitations({
        query: { organizationId: organization.id },
      });
      if (error)
        throw new Error(
          error.message ?? "Einladungen konnten nicht geladen werden.",
        );
      return { organization, invitations: data ?? [] };
    },
  });
  async function cancel(invitationId: string) {
    if (!state) return;
    await authClient.organization.cancelInvitation({
      invitationId,
    });
    await queryClient.invalidateQueries({
      queryKey: ["organization", orgSlug, "invitations"],
    });
  }
  return (
    <div className="space-y-6 p-5 sm:p-7">
      <PageHeader
        title="Ausstehende Einladungen"
        description="Prüfe ausstehende Zugriffe oder widerrufe nicht mehr benötigte Einladungen."
      />
      <section className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#172128]/90">
        {isLoading ? (
          <p className="p-5 text-sm text-zinc-500">
            Einladungen werden geladen …
          </p>
        ) : null}
        {state?.invitations.length === 0 ? (
          <p className="p-8 text-center text-sm text-zinc-500">
            Keine ausstehenden Einladungen.
          </p>
        ) : null}
        {state?.invitations.map((invitation) => (
          <div
            className="flex items-center gap-4 border-b border-white/[0.06] p-5 last:border-0"
            key={invitation.id}
          >
            <span className="grid size-9 place-items-center rounded-xl bg-[#00cec9]/10">
              <Mail className="size-4 text-[#81ecec]" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-zinc-200">
                {invitation.email}
              </span>
              <span className="text-xs text-zinc-500">
                {invitation.role} · gültig bis{" "}
                {new Date(invitation.expiresAt).toLocaleDateString("de-DE")}
              </span>
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => cancel(invitation.id)}
            >
              <X /> Widerrufen
            </Button>
          </div>
        ))}
      </section>
    </div>
  );
}
