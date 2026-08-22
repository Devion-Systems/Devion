"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRight, FolderKanban, Plus, Search, Users, UsersRound } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { DesignEmptyState } from "@/components/layout/design-empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";

type Team = {
  id: string;
  name: string;
  memberCount: number;
  projectCount: number;
};

const api = (path: string) => `${process.env.NEXT_PUBLIC_API_URL ?? ""}${path}`;

export default function TeamsPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const [search, setSearch] = useState("");
  const teams = useQuery<Team[]>({
    queryKey: ["org", orgSlug, "teams"],
    queryFn: async () => {
      const response = await fetch(api(`/organizations/${orgSlug}/teams`), { credentials: "include" });
      if (!response.ok) throw new Error("Teams konnten nicht geladen werden.");
      return response.json();
    },
  });

  const teamList = teams.data ?? [];
  const visible = useMemo(
    () => teamList.filter((team) => team.name.toLocaleLowerCase("de-DE").includes(search.toLocaleLowerCase("de-DE"))),
    [search, teamList],
  );
  const memberAssignments = teamList.reduce((total, team) => total + team.memberCount, 0);
  const projectAssignments = teamList.reduce((total, team) => total + team.projectCount, 0);

  return (
    <div className="space-y-6 p-5 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader title="Teams" description="Ordne Mitglieder und Projekte den Arbeitsgruppen zu, die sie tatsächlich verwalten." />
        <Button asChild className="min-h-10"><Link href={`/${orgSlug}/teams/new`}><Plus className="size-4" />Neues Team</Link></Button>
      </div>

      {teams.isError ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-100">
          <span>{teams.error.message}</span>
          <Button size="sm" variant="outline" onClick={() => void teams.refetch()}>Erneut versuchen</Button>
        </div>
      ) : null}

      {teams.isLoading ? (
        <div className="space-y-4"><div className="h-28 animate-pulse rounded-2xl bg-white/[0.05]" /><div className="h-64 animate-pulse rounded-2xl bg-white/[0.05]" /></div>
      ) : null}

      {!teams.isLoading && !teams.isError && teamList.length === 0 ? (
        <DesignEmptyState
          icon={UsersRound}
          title="Noch keine Teams"
          description="Erstelle ein Team, um Verantwortlichkeiten für Projekte und Mitglieder klar zuzuordnen."
          detail="Ein Team ist ein Arbeitsbereich innerhalb deiner Organisation und kann mehrere Projekte verwalten."
          action={{ label: "Neues Team erstellen", href: `/${orgSlug}/teams/new` }}
        />
      ) : null}

      {!teams.isLoading && !teams.isError && teamList.length > 0 ? (
        <>
          <section aria-label="Teamübersicht" className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/[0.08] bg-[#172128] p-4"><p className="text-xs font-medium uppercase tracking-[0.12em] text-zinc-500">Teams</p><p className="mt-2 text-2xl font-semibold tracking-tight text-zinc-50">{teamList.length}</p><p className="mt-1 text-sm text-zinc-500">Arbeitsbereiche in dieser Organisation</p></div>
            <div className="rounded-2xl border border-white/[0.08] bg-[#172128] p-4"><p className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.12em] text-zinc-500"><Users className="size-3.5" /> Mitgliederzuordnungen</p><p className="mt-2 text-2xl font-semibold tracking-tight text-zinc-50">{memberAssignments}</p><p className="mt-1 text-sm text-zinc-500">Mitglieder können mehreren Teams angehören</p></div>
            <div className="rounded-2xl border border-white/[0.08] bg-[#172128] p-4"><p className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.12em] text-zinc-500"><FolderKanban className="size-3.5" /> Projektzuordnungen</p><p className="mt-2 text-2xl font-semibold tracking-tight text-zinc-50">{projectAssignments}</p><p className="mt-1 text-sm text-zinc-500">Projekte mit klarer Teamverantwortung</p></div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#172128]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] px-5 py-4">
              <div><h2 className="font-medium text-zinc-100">Arbeitsbereiche</h2><p className="mt-1 text-sm text-zinc-500">Öffne ein Team, um Mitglieder und zugeordnete Projekte zu verwalten.</p></div>
              <div className="relative w-full sm:w-72"><Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-zinc-500" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Teams suchen …" className="h-10 w-full rounded-xl border border-white/[0.08] bg-white/[0.035] pl-9 pr-3 text-sm text-zinc-200 outline-none transition placeholder:text-zinc-600 focus:border-[#81ecec]/70 focus:ring-2 focus:ring-[#81ecec]/20" /></div>
            </div>
            {visible.length === 0 ? <p className="px-5 py-12 text-center text-sm text-zinc-500">Keine Teams entsprechen der Suche.</p> : null}
            <div className="hidden lg:block"><table className="w-full text-left text-sm"><thead className="border-b border-white/[0.06] bg-black/10 text-xs uppercase tracking-[0.1em] text-zinc-500"><tr><th className="px-5 py-3 font-medium">Team</th><th className="px-4 py-3 font-medium">Mitglieder</th><th className="px-4 py-3 font-medium">Projekte</th><th className="px-5 py-3 text-right font-medium"><span className="sr-only">Verwalten</span></th></tr></thead><tbody className="divide-y divide-white/[0.06]">{visible.map((team) => <tr key={team.id} className="transition-colors hover:bg-white/[0.025]"><td className="px-5 py-4"><span className="inline-flex items-center gap-2 font-medium text-zinc-100"><UsersRound className="size-4 text-[#81ecec]" />{team.name}</span></td><td className="px-4 py-4 text-zinc-300">{team.memberCount} {team.memberCount === 1 ? "Mitglied" : "Mitglieder"}</td><td className="px-4 py-4 text-zinc-300">{team.projectCount} {team.projectCount === 1 ? "Projekt" : "Projekte"}</td><td className="px-5 py-4 text-right"><Button asChild variant="ghost" size="sm" className="min-h-9 text-zinc-300 hover:text-[#81ecec]"><Link href={`/${orgSlug}/teams/${team.id}`}>Verwalten <ArrowRight className="size-3.5" /></Link></Button></td></tr>)}</tbody></table></div>
            <div className="divide-y divide-white/[0.06] lg:hidden">{visible.map((team) => <Link key={team.id} href={`/${orgSlug}/teams/${team.id}`} className="block p-5 transition-colors hover:bg-white/[0.025] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#81ecec]"><div className="flex items-start justify-between gap-3"><span className="inline-flex min-w-0 items-center gap-2 font-medium text-zinc-100"><UsersRound className="size-4 shrink-0 text-[#81ecec]" /><span className="truncate">{team.name}</span></span><ArrowRight className="size-4 shrink-0 text-[#81ecec]" /></div><div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/[0.06] pt-3 text-sm"><span className="text-zinc-500"><strong className="font-medium text-zinc-200">{team.memberCount}</strong> Mitglieder</span><span className="text-zinc-500"><strong className="font-medium text-zinc-200">{team.projectCount}</strong> Projekte</span></div></Link>)}</div>
          </section>
        </>
      ) : null}
    </div>
  );
}
