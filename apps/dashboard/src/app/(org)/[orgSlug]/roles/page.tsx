"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { authClient } from "@/lib/auth-client";

const roleInfo = {
  owner:
    "Voller Zugriff einschließlich Organisation löschen und Owner-Rollen verwalten.",
  admin: "Verwaltet Mitglieder, Einladungen, Teams und Projekte.",
  member: "Arbeitet mit freigegebenen Projekten und Ressourcen.",
};

export default function RolesPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const queryClient = useQueryClient();
  const { data: state, isLoading } = useQuery({
    queryKey: ["organization", orgSlug, "roles"],
    queryFn: async () => {
      const organizations = await authClient.organization.list();
      const organization = organizations.data?.find(
        (item) => item.slug === orgSlug,
      );
      if (!organization) throw new Error("Organisation nicht gefunden.");
      const { data, error } = await authClient.organization.listMembers({
        query: { organizationId: organization.id },
      });
      if (error)
        throw new Error(
          error.message ?? "Mitglieder konnten nicht geladen werden.",
        );
      return { organization, members: data?.members ?? data ?? [] };
    },
  });
  async function updateRole(memberId: string, role: string) {
    if (!state) return;
    await authClient.organization.updateMemberRole({
      memberId,
      role,
      organizationId: state.organization.id,
    });
    await queryClient.invalidateQueries({
      queryKey: ["organization", orgSlug, "roles"],
    });
    await queryClient.invalidateQueries({
      queryKey: ["organization", orgSlug, "members"],
    });
  }
  return (
    <div className="space-y-6 p-5 sm:p-7">
      <PageHeader
        title="Rollen & Rechte"
        description="Lege fest, wer diese Organisation verwalten oder darin arbeiten darf."
      />
      <section className="grid gap-3 md:grid-cols-3">
        {Object.entries(roleInfo).map(([role, description]) => (
          <article
            className="rounded-2xl border border-white/[0.07] bg-[#172128] p-4"
            key={role}
          >
            <ShieldCheck className="size-5 text-[#81ecec]" />
            <h2 className="mt-3 font-semibold capitalize text-zinc-100">
              {role}
            </h2>
            <p className="mt-1 text-xs leading-5 text-zinc-500">
              {description}
            </p>
          </article>
        ))}
      </section>
      <section className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#172128]/90">
        {isLoading ? (
          <p className="p-5 text-sm text-zinc-500">Rollen werden geladen …</p>
        ) : null}
        {state?.members.map((member) => (
          <div
            className="flex items-center gap-4 border-b border-white/[0.06] p-5 last:border-0"
            key={member.id}
          >
            <span className="grid size-9 place-items-center rounded-full bg-[#0984e3]/15 font-semibold text-[#74b9ff]">
              {member.user.name.slice(0, 1).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-zinc-200">
                {member.user.name}
              </span>
              <span className="block truncate text-xs text-zinc-500">
                {member.user.email}
              </span>
            </span>
            <select
              aria-label={`Rolle von ${member.user.name}`}
              className="h-9 rounded-xl border border-white/[0.1] bg-[#0b1217] px-3 text-sm text-zinc-200"
              value={member.role}
              onChange={(event) => updateRole(member.id, event.target.value)}
            >
              <option value="owner">Owner</option>
              <option value="admin">Admin</option>
              <option value="member">Member</option>
            </select>
          </div>
        ))}
      </section>
    </div>
  );
}
