"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MailPlus, Trash2, UsersRound } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

const roles = ["member", "admin"] as const;

export default function MembersPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<(typeof roles)[number]>("member");
  const [message, setMessage] = useState<string | null>(null);
  const [isInviting, setIsInviting] = useState(false);
  const { data: state, isLoading } = useQuery({
    queryKey: ["organization", orgSlug, "members"],
    queryFn: async () => {
      const organizations = await authClient.organization.list();
      const current = organizations.data?.find(
        (organization) => organization.slug === orgSlug,
      );
      if (!current) throw new Error("Organisation nicht gefunden.");
      const { data, error } = await authClient.organization.listMembers({
        query: { organizationId: current.id },
      });
      if (error)
        throw new Error(
          error.message ?? "Mitglieder konnten nicht geladen werden.",
        );
      return { organization: current, members: data?.members ?? data ?? [] };
    },
  });

  async function refresh() {
    await queryClient.invalidateQueries({
      queryKey: ["organization", orgSlug, "members"],
    });
  }
  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!state) return;
    setIsInviting(true);
    setMessage(null);
    const { error } = await authClient.organization.inviteMember({
      email: email.trim(),
      role,
      organizationId: state.organization.id,
    });
    setIsInviting(false);
    if (error) {
      setMessage(error.message ?? "Einladung konnte nicht gesendet werden.");
      return;
    }
    setEmail("");
    setMessage("Einladung wurde per E-Mail versendet.");
  }
  async function remove(memberId: string) {
    if (
      !state ||
      !window.confirm("Mitglied wirklich aus der Organisation entfernen?")
    )
      return;
    const { error } = await authClient.organization.removeMember({
      memberId,
      organizationId: state.organization.id,
    });
    setMessage(
      error
        ? (error.message ?? "Mitglied konnte nicht entfernt werden.")
        : "Mitglied entfernt.",
    );
    await refresh();
  }

  return (
    <div className="space-y-6 p-5 sm:p-7">
      <PageHeader
        title="Mitglieder"
        description="Lade Personen ein und verwalte die Mitgliedschaften dieser Organisation."
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <section className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#172128]/90">
          {isLoading ? (
            <p className="p-5 text-sm text-zinc-500">
              Mitglieder werden geladen …
            </p>
          ) : null}
          {state?.members.map((member) => (
            <div
              className="flex flex-wrap items-center gap-3 border-b border-white/[0.06] p-5 last:border-0"
              key={member.id}
            >
              <span className="grid size-9 place-items-center rounded-full bg-[#0984e3]/15 font-semibold text-[#74b9ff]">
                {member.user.name.slice(0, 1).toUpperCase()}
              </span>
              <button
                className="min-w-0 flex-1 text-left"
                onClick={() =>
                  router.push(`/${orgSlug}/members/${member.userId}`)
                }
                type="button"
              >
                <span className="block truncate text-sm font-medium text-zinc-200">
                  {member.user.name}
                </span>
                <span className="block truncate text-xs text-zinc-500">
                  {member.user.email}
                </span>
              </button>
              <span className="rounded-lg border border-white/[0.1] bg-[#0b1217] px-2 py-1 text-xs text-zinc-300">
                {member.role}
              </span>
              <Button
                aria-label={`${member.user.name} entfernen`}
                size="icon-sm"
                variant="ghost"
                onClick={() => remove(member.id)}
              >
                <Trash2 />
              </Button>
            </div>
          ))}
        </section>
        <aside className="h-fit rounded-2xl border border-[#00cec9]/15 bg-[#00cec9]/[0.04] p-5">
          <div className="flex items-center gap-2">
            <UsersRound className="size-5 text-[#81ecec]" />
            <h2 className="font-semibold text-zinc-100">Mitglied einladen</h2>
          </div>
          <p className="mt-2 text-sm text-zinc-500">
            Die Einladung läuft nach 48 Stunden ab.
          </p>
          <form className="mt-5 space-y-3" onSubmit={invite}>
            <input
              className="h-10 w-full rounded-xl border border-white/[0.1] bg-[#0b1217] px-3 text-sm outline-none focus:border-[#00cec9]/60"
              type="email"
              placeholder="name@firma.de"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
            <select
              className="h-10 w-full rounded-xl border border-white/[0.1] bg-[#0b1217] px-3 text-sm text-zinc-200"
              value={role}
              onChange={(event) => setRole(event.target.value as typeof role)}
            >
              <option value="member">Member — Projekte verwenden</option>
              <option value="admin">
                Admin — Mitglieder und Projekte verwalten
              </option>
            </select>
            <Button className="w-full" type="submit" disabled={isInviting}>
              {isInviting ? "Sende …" : "Einladung senden"}
              <MailPlus />
            </Button>
          </form>
          {message ? (
            <p className="mt-4 text-sm text-[#81ecec]">{message}</p>
          ) : null}
          <button
            className="mt-5 text-sm text-[#81ecec] hover:underline"
            onClick={() => router.push(`/${orgSlug}/members/invites`)}
            type="button"
          >
            Ausstehende Einladungen verwalten
          </button>
        </aside>
      </div>
    </div>
  );
}
