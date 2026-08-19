"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowRight, FolderGit2, GitBranch, Link2, Upload } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

type ProjectType = "git" | "docker" | "blank";

const PROJECT_TYPES: {
  type: ProjectType;
  label: string;
  description: string;
  icon: React.ElementType;
}[] = [
  {
    type: "git",
    label: "Git-Repository",
    description: "Verbinde ein GitHub-, GitLab- oder Gitea-Repository",
    icon: GitBranch,
  },
  {
    type: "docker",
    label: "Docker-Image",
    description: "Deploye direkt ein Docker-Image aus einer Registry",
    icon: Upload,
  },
  {
    type: "blank",
    label: "Leeres Projekt",
    description: "Starte ohne Vorlage und konfiguriere alles manuell",
    icon: FolderGit2,
  },
];

export default function NewProjectPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const router = useRouter();
  const [type, setType] = useState<ProjectType>("git");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [gitUrl, setGitUrl] = useState("");
  const [branch, setBranch] = useState("main");
  const [teamId, setTeamId] = useState("");

  const { data: teams = [] } = useQuery({
    queryKey: ["organizations", orgSlug, "teams"],
    queryFn: async () => {
      const organizations = await authClient.organization.list();
      const currentOrganization = organizations.data?.find(
        (item) => item.slug === orgSlug,
      );
      if (!currentOrganization) return [];
      const { data } = await authClient.organization.listTeams({
        query: { organizationId: currentOrganization.id },
      });
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "";
      const res = await fetch(`${baseUrl}/organizations/${orgSlug}/projects`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          slug: name,
          description,
          type,
          gitUrl,
          branch,
          teamId: teamId || undefined,
        }),
      });
      if (!res.ok) throw new Error("Projekt konnte nicht erstellt werden");
      return res.json() as Promise<{ id: string }>;
    },
    onSuccess: (data) => router.push(`/${orgSlug}/projects/${data.id}`),
  });

  return (
    <div className="mx-auto max-w-2xl space-y-8 p-6">
      <PageHeader
        title="Neues Projekt"
        description="Erstelle und konfiguriere dein Projekt"
      />

      {/* Project Type */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-zinc-300">Projekttyp</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {PROJECT_TYPES.map(
            ({ type: t, label, description: desc, icon: Icon }) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={cn(
                  "flex flex-col items-start gap-2.5 rounded-xl border p-4 text-left transition-all",
                  type === t
                    ? "border-[#0984e3]/60 bg-[#0984e3]/8"
                    : "border-white/[0.06] bg-[#1e272e] hover:border-white/[0.12]",
                )}
              >
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-lg",
                    type === t ? "bg-[#0984e3]/20" : "bg-white/[0.04]",
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4",
                      type === t ? "text-[#0984e3]" : "text-zinc-400",
                    )}
                  />
                </div>
                <div>
                  <p
                    className={cn(
                      "text-sm font-medium",
                      type === t ? "text-zinc-100" : "text-zinc-300",
                    )}
                  >
                    {label}
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-500">{desc}</p>
                </div>
              </button>
            ),
          )}
        </div>
      </div>

      {/* Form */}
      <div className="space-y-4">
        <div>
          <label
            className="mb-1.5 block text-sm font-medium text-zinc-300"
            htmlFor="project-name"
          >
            Projektname *
          </label>
          <input
            id="project-name"
            type="text"
            value={name}
            onChange={(e) =>
              setName(e.target.value.toLowerCase().replace(/\s/g, "-"))
            }
            placeholder="mein-projekt"
            className="h-9 w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-[#0984e3]/50 focus:outline-none focus:ring-2 focus:ring-[#0984e3]/20"
          />
          <p className="mt-1 text-[11px] text-zinc-600">
            Nur Kleinbuchstaben, Zahlen und Bindestriche
          </p>
        </div>

        <div>
          <label
            className="mb-1.5 block text-sm font-medium text-zinc-300"
            htmlFor="project-team"
          >
            Team <span className="font-normal text-zinc-600">(optional)</span>
          </label>
          <select
            className="h-9 w-full rounded-lg border border-white/[0.08] bg-[#1e272e] px-3 text-sm text-zinc-200 focus:border-[#0984e3]/50 focus:outline-none focus:ring-2 focus:ring-[#0984e3]/20"
            id="project-team"
            value={teamId}
            onChange={(event) => setTeamId(event.target.value)}
          >
            <option value="">Keinem Team zuordnen</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            className="mb-1.5 block text-sm font-medium text-zinc-300"
            htmlFor="project-description"
          >
            Beschreibung
          </label>
          <input
            id="project-description"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Kurze Beschreibung …"
            className="h-9 w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-[#0984e3]/50 focus:outline-none focus:ring-2 focus:ring-[#0984e3]/20"
          />
        </div>

        {type === "git" && (
          <>
            <div>
              <label
                className="mb-1.5 block text-sm font-medium text-zinc-300"
                htmlFor="project-git-url"
              >
                Repository-URL
              </label>
              <div className="flex items-center gap-2">
                <Link2 className="h-4 w-4 shrink-0 text-zinc-500" />
                <input
                  id="project-git-url"
                  type="text"
                  value={gitUrl}
                  onChange={(e) => setGitUrl(e.target.value)}
                  placeholder="https://github.com/org/repo"
                  className="h-9 flex-1 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-[#0984e3]/50 focus:outline-none focus:ring-2 focus:ring-[#0984e3]/20"
                />
              </div>
            </div>
            <div>
              <label
                className="mb-1.5 block text-sm font-medium text-zinc-300"
                htmlFor="project-branch"
              >
                Branch
              </label>
              <input
                id="project-branch"
                type="text"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                placeholder="main"
                className="h-9 w-48 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:border-[#0984e3]/50 focus:outline-none focus:ring-2 focus:ring-[#0984e3]/20"
              />
            </div>
          </>
        )}
      </div>

      {/* Submit */}
      <div className="flex items-center justify-between gap-4 border-t border-white/[0.06] pt-6">
        <Button variant="ghost" onClick={() => router.back()}>
          Abbrechen
        </Button>
        <Button
          onClick={() => create.mutate()}
          disabled={!name || create.isPending}
          className="gap-2"
        >
          {create.isPending ? "Erstelle …" : "Projekt erstellen"}
          {!create.isPending && <ArrowRight className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </div>
  );
}
