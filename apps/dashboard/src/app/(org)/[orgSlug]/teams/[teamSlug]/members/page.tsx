"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UserMinus, UserPlus, Users } from "lucide-react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";

type Person = { userId: string; name: string; email: string; role?: string };
type Team = { id: string; name: string; members: Person[] };
const api = (path: string) => `${process.env.NEXT_PUBLIC_API_URL ?? ""}${path}`;

export default function TeamMembersPage() {
  const { orgSlug, teamSlug } = useParams<{ orgSlug: string; teamSlug: string }>();
  const client = useQueryClient();
  const team = useQuery<Team>({ queryKey: ["org", orgSlug, "team", teamSlug], queryFn: async () => { const r = await fetch(api(`/organizations/${orgSlug}/teams/${teamSlug}`), { credentials: "include" }); if (!r.ok) throw new Error("Team konnte nicht geladen werden"); return r.json(); } });
  const organizationMembers = useQuery<Person[]>({ queryKey: ["org", orgSlug, "team-members"], queryFn: async () => { const r = await fetch(api(`/organizations/${orgSlug}/team-members`), { credentials: "include" }); if (!r.ok) throw new Error("Organisationsmitglieder konnten nicht geladen werden"); return r.json(); } });
  const refresh = () => client.invalidateQueries({ queryKey: ["org", orgSlug, "team", teamSlug] });
  const add = useMutation({ mutationFn: async (userId: string) => { const r = await fetch(api(`/organizations/${orgSlug}/teams/${teamSlug}/members`), { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ userId }) }); if (!r.ok) throw new Error("Mitglied konnte nicht hinzugefügt werden"); }, onSuccess: refresh });
  const remove = useMutation({ mutationFn: async (userId: string) => { const r = await fetch(api(`/organizations/${orgSlug}/teams/${teamSlug}/members/${userId}`), { method: "DELETE", credentials: "include" }); if (!r.ok) throw new Error("Mitglied konnte nicht entfernt werden"); }, onSuccess: refresh });
  const members = team.data?.members ?? [];
  const available = (organizationMembers.data ?? []).filter((person) => !members.some((member) => member.userId === person.userId));

  return <div className="space-y-6 p-6"><PageHeader title="Team-Mitglieder" description="Teams sind Arbeitsgruppen innerhalb dieser Organisation. Mitglieder bleiben Organisationsmitglieder." />{team.isError || organizationMembers.isError ? <p className="rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-100">Mitglieder konnten nicht geladen werden.</p> : null}<div className="grid gap-4 lg:grid-cols-2"><section className="rounded-2xl border border-white/[0.07] bg-[#172128] p-5"><h2 className="flex items-center gap-2 font-semibold text-zinc-100"><Users className="size-4 text-[#81ecec]" /> Im Team ({members.length})</h2><div className="mt-4 space-y-3">{members.map((person) => <div key={person.userId} className="flex items-center gap-3"><div className="min-w-0 flex-1"><p className="truncate text-sm text-zinc-200">{person.name}</p><p className="truncate text-xs text-zinc-500">{person.email}</p></div><Button size="sm" variant="ghost" onClick={() => remove.mutate(person.userId)} disabled={remove.isPending}><UserMinus className="size-4" /> Entfernen</Button></div>)}{!team.isLoading && !members.length ? <p className="text-sm text-zinc-500">Diesem Team sind noch keine Mitglieder zugewiesen.</p> : null}</div></section><section className="rounded-2xl border border-white/[0.07] bg-[#172128] p-5"><h2 className="flex items-center gap-2 font-semibold text-zinc-100"><UserPlus className="size-4 text-[#81ecec]" /> Aus Organisation hinzufügen</h2><div className="mt-4 space-y-3">{available.map((person) => <div key={person.userId} className="flex items-center gap-3"><div className="min-w-0 flex-1"><p className="truncate text-sm text-zinc-200">{person.name}</p><p className="truncate text-xs text-zinc-500">{person.email}</p></div><Button size="sm" variant="outline" onClick={() => add.mutate(person.userId)} disabled={add.isPending}>Hinzufügen</Button></div>)}{!organizationMembers.isLoading && !available.length ? <p className="text-sm text-zinc-500">Alle Organisationsmitglieder sind bereits im Team.</p> : null}</div></section></div></div>;
}
