"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  CheckCircle2,
  Clock,
  FolderGit2,
  GitBranch,
  MoreHorizontal,
  Plus,
  Search,
  XCircle,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";

type ProjectStatus = "healthy" | "degraded" | "failing" | "idle";

type Project = {
  id: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  lastDeploy: string;
  branch: string;
  environment: string;
  deployCount: number;
};

const STATUS: Record<
  ProjectStatus,
  { label: string; icon: React.ElementType; color: string; dot: string }
> = {
  healthy: {
    label: "Aktiv",
    icon: CheckCircle2,
    color: "text-emerald-400",
    dot: "bg-emerald-400",
  },
  degraded: {
    label: "Beeinträchtigt",
    icon: Activity,
    color: "text-amber-400",
    dot: "bg-amber-400",
  },
  failing: {
    label: "Fehler",
    icon: XCircle,
    color: "text-red-400",
    dot: "bg-red-400",
  },
  idle: {
    label: "Inaktiv",
    icon: Clock,
    color: "text-zinc-500",
    dot: "bg-zinc-600",
  },
};

function useProjects(orgSlug: string) {
  return useQuery<Project[]>({
    queryKey: ["orgs", orgSlug, "projects"],
    queryFn: async () => {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "";
      const res = await fetch(`${baseUrl}/organizations/${orgSlug}/projects`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Projekte konnten nicht geladen werden");
      return res.json();
    },
    placeholderData: [
      {
        id: "p1",
        name: "api-gateway",
        description: "Zentrales API-Gateway für alle Services",
        status: "healthy",
        lastDeploy: "Vor 5 Min.",
        branch: "main",
        environment: "production",
        deployCount: 142,
      },
      {
        id: "p2",
        name: "frontend-app",
        description: "React-Frontend der Kundenplattform",
        status: "healthy",
        lastDeploy: "Vor 1 Std.",
        branch: "feat/new-ui",
        environment: "staging",
        deployCount: 87,
      },
      {
        id: "p3",
        name: "worker-service",
        description: "Hintergrundverarbeitungs-Service",
        status: "failing",
        lastDeploy: "Vor 2 Std.",
        branch: "main",
        environment: "production",
        deployCount: 56,
      },
      {
        id: "p4",
        name: "auth-service",
        description: "Authentifizierung & Autorisierung",
        status: "healthy",
        lastDeploy: "Vor 3 Std.",
        branch: "main",
        environment: "production",
        deployCount: 203,
      },
      {
        id: "p5",
        name: "data-pipeline",
        description: "ETL-Pipeline für Analytics",
        status: "idle",
        lastDeploy: "Vor 2 Tagen",
        branch: "develop",
        environment: "dev",
        deployCount: 29,
      },
      {
        id: "p6",
        name: "notification-svc",
        description: "E-Mail- & Push-Benachrichtigungen",
        status: "degraded",
        lastDeploy: "Vor 6 Std.",
        branch: "main",
        environment: "production",
        deployCount: 74,
      },
    ],
  });
}

export default function ProjectsPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const router = useRouter();
  const { data: projects = [], isLoading } = useProjects(orgSlug);
  const [search, setSearch] = useState("");

  const filtered = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description?.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-6 p-5 sm:p-7">
      <PageHeader
        title="Projekte"
        description={`${projects.length} Projekte in dieser Organisation`}
      />

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder="Projekte suchen …"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full rounded-xl border border-white/[0.08] bg-white/[0.035] pl-9 pr-3 text-sm text-zinc-200 placeholder:text-zinc-600 transition hover:border-white/[0.13] focus:border-[#00cec9]/50 focus:outline-none focus:ring-4 focus:ring-[#00cec9]/10"
          />
        </div>
        <Button
          onClick={() => router.push(`/${orgSlug}/projects/new`)}
          className="gap-2"
        >
          <Plus className="h-3.5 w-3.5" />
          Neues Projekt
        </Button>
      </div>

      {/* Projekt-Grid */}
      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {["one", "two", "three", "four", "five", "six"].map((key) => (
            <div
              key={key}
              className="h-36 animate-pulse rounded-2xl border border-white/[0.06] bg-[#172128]"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-white/[0.1] bg-[#172128]/50 py-20 text-center">
          <FolderGit2 className="h-8 w-8 text-zinc-600" />
          <div>
            <p className="text-sm font-medium text-zinc-300">
              Keine Projekte gefunden
            </p>
            <p className="mt-1 text-xs text-zinc-600">
              {search
                ? "Andere Suchbegriffe versuchen"
                : "Erstelle dein erstes Projekt"}
            </p>
          </div>
          {!search && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/${orgSlug}/projects/new`)}
              className="mt-1 gap-2"
            >
              <Plus className="h-3.5 w-3.5" />
              Projekt erstellen
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((project) => {
            const s = STATUS[project.status];
            const Icon = s.icon;
            return (
              <button
                key={project.id}
                type="button"
                onClick={() =>
                  router.push(`/${orgSlug}/projects/${project.id}`)
                }
                className="group flex flex-col rounded-2xl border border-white/[0.07] bg-[#172128]/90 p-5 text-left shadow-[0_12px_32px_rgba(0,0,0,.1)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#0984e3]/35 hover:bg-[#19262f]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${s.dot}`}
                      />
                      <h3 className="truncate font-medium text-zinc-100">
                        {project.name}
                      </h3>
                    </div>
                    {project.description && (
                      <p className="mt-1 line-clamp-2 text-xs text-zinc-500">
                        {project.description}
                      </p>
                    )}
                  </div>
                  <MoreHorizontal className="h-4 w-4 shrink-0 text-zinc-600 opacity-0 transition-opacity group-hover:opacity-100" />
                </div>

                <div className="mt-4 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                    <Icon className={`h-3 w-3 ${s.color}`} />
                    <span className={s.color}>{s.label}</span>
                    <span className="mx-1 text-zinc-700">·</span>
                    <Clock className="h-3 w-3" />
                    <span>{project.lastDeploy}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-zinc-600">
                    <GitBranch className="h-3 w-3" />
                    <span className="font-mono">{project.branch}</span>
                    <span className="mx-1 text-zinc-700">·</span>
                    <span className="rounded border border-white/[0.06] px-1.5 py-0.5 text-[10px]">
                      {project.environment}
                    </span>
                  </div>
                </div>

                <div className="mt-4 border-t border-white/[0.05] pt-3">
                  <span className="text-[11px] text-zinc-600">
                    {project.deployCount} Deployments
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
