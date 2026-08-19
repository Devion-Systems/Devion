"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  CheckCircle2,
  Clock,
  GitBranch,
  Server,
  TrendingUp,
  XCircle,
  Zap,
} from "lucide-react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";

type DeploymentStatus = "success" | "failed" | "pending" | "running";

type RecentDeployment = {
  id: string;
  project: string;
  environment: string;
  status: DeploymentStatus;
  branch: string;
  commit: string;
  deployedAt: string;
  duration: string;
};

type OrgStats = {
  activeProjects: number;
  totalDeployments: number;
  failedToday: number;
  avgBuildTime: string;
  cpuUsage: number;
  memoryUsage: number;
  recentDeployments: RecentDeployment[];
};

const STATUS_CONFIG: Record<
  DeploymentStatus,
  { icon: React.ElementType; label: string; color: string; bg: string }
> = {
  success: {
    icon: CheckCircle2,
    label: "Erfolgreich",
    color: "text-emerald-400",
    bg: "bg-emerald-400/10",
  },
  failed: {
    icon: XCircle,
    label: "Fehlgeschlagen",
    color: "text-red-400",
    bg: "bg-red-400/10",
  },
  pending: {
    icon: Clock,
    label: "Ausstehend",
    color: "text-zinc-400",
    bg: "bg-zinc-400/10",
  },
  running: {
    icon: Activity,
    label: "Läuft",
    color: "text-[#0984e3]",
    bg: "bg-[#0984e3]/10",
  },
};

function useDashboardStats(orgSlug: string) {
  return useQuery<OrgStats>({
    queryKey: ["orgs", orgSlug, "dashboard"],
    queryFn: async () => {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "";
      const res = await fetch(`${baseUrl}/organizations/${orgSlug}/dashboard`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Dashboard-Daten nicht verfügbar");
      return res.json();
    },
    // Fallback-Daten für die Entwicklung
    placeholderData: {
      activeProjects: 12,
      totalDeployments: 847,
      failedToday: 2,
      avgBuildTime: "2m 34s",
      cpuUsage: 42,
      memoryUsage: 68,
      recentDeployments: [
        {
          id: "1",
          project: "api-gateway",
          environment: "production",
          status: "success",
          branch: "main",
          commit: "a3f8c2d",
          deployedAt: "Vor 5 Min.",
          duration: "2m 12s",
        },
        {
          id: "2",
          project: "frontend-app",
          environment: "staging",
          status: "running",
          branch: "feat/new-ui",
          commit: "b91e4f7",
          deployedAt: "Vor 12 Min.",
          duration: "—",
        },
        {
          id: "3",
          project: "worker-service",
          environment: "production",
          status: "failed",
          branch: "main",
          commit: "d5c2a89",
          deployedAt: "Vor 1 Std.",
          duration: "45s",
        },
        {
          id: "4",
          project: "auth-service",
          environment: "production",
          status: "success",
          branch: "main",
          commit: "f2e1b4c",
          deployedAt: "Vor 2 Std.",
          duration: "1m 58s",
        },
        {
          id: "5",
          project: "data-pipeline",
          environment: "dev",
          status: "pending",
          branch: "develop",
          commit: "c7d3e12",
          deployedAt: "Vor 3 Std.",
          duration: "—",
        },
      ],
    },
  });
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#172128]/90 p-5 shadow-[0_12px_32px_rgba(0,0,0,.1)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#0984e3]/35 hover:bg-[#19262f]">
      <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-[#0984e3]/[0.07] blur-2xl transition group-hover:bg-[#00cec9]/[0.09]" />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            {label}
          </p>
          <p
            className={`mt-2 text-2xl font-bold tabular-nums ${accent ?? "text-zinc-100"}`}
          >
            {value}
          </p>
          {sub && <p className="mt-0.5 text-xs text-zinc-600">{sub}</p>}
        </div>
        <div className="relative rounded-xl border border-white/[0.06] bg-white/[0.04] p-2.5">
          <Icon className="h-4 w-4 text-[#81ecec]" />
        </div>
      </div>
    </div>
  );
}

function GaugeBar({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div>
      <div className="mb-1.5 flex justify-between text-xs">
        <span className="text-zinc-400">{label}</span>
        <span className="font-mono text-zinc-300">{value}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

export default function OrgOverviewPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const { data: stats, isLoading } = useDashboardStats(orgSlug);

  return (
    <div className="space-y-6 p-5 sm:p-7">
      <PageHeader
        title="Dashboard"
        description="Übersicht über aktive Deployments, Ressourcen-Auslastung und letzte Aktivität"
      />

      {/* KPI-Karten */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={GitBranch}
          label="Aktive Projekte"
          value={isLoading ? "—" : (stats?.activeProjects ?? 0)}
        />
        <StatCard
          icon={TrendingUp}
          label="Deployments gesamt"
          value={isLoading ? "—" : (stats?.totalDeployments ?? 0)}
          sub="Alle Zeiten"
        />
        <StatCard
          icon={XCircle}
          label="Fehler heute"
          value={isLoading ? "—" : (stats?.failedToday ?? 0)}
          accent={stats?.failedToday ? "text-red-400" : "text-zinc-100"}
        />
        <StatCard
          icon={Zap}
          label="Ø Build-Dauer"
          value={isLoading ? "—" : (stats?.avgBuildTime ?? "—")}
          sub="Letzte 30 Tage"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Letzte Deployments */}
        <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#172128]/90 shadow-[0_12px_32px_rgba(0,0,0,.1)] lg:col-span-2">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
            <h2 className="text-sm font-semibold text-zinc-100">
              Letzte Deployments
            </h2>
            <span className="flex items-center gap-1.5 rounded-full border border-[#00cec9]/15 bg-[#00cec9]/[0.06] px-2.5 py-1 text-xs text-[#81ecec]">
              <span className="devion-status-dot h-1.5 w-1.5 rounded-full bg-[#00cec9]" />{" "}
              Live
            </span>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {(stats?.recentDeployments ?? []).map((dep) => {
              const cfg = STATUS_CONFIG[dep.status];
              const Icon = cfg.icon;
              return (
                <div
                  key={dep.id}
                  className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-white/[0.035]"
                >
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${cfg.bg}`}
                  >
                    <Icon className={`h-3.5 w-3.5 ${cfg.color}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-zinc-100">
                        {dep.project}
                      </span>
                      <span className="shrink-0 rounded-full border border-white/[0.08] px-1.5 py-0.5 text-[10px] text-zinc-500">
                        {dep.environment}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-xs text-zinc-500">
                      <GitBranch className="h-3 w-3" />
                      <span>{dep.branch}</span>
                      <span className="font-mono">{dep.commit}</span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={`text-xs font-medium ${cfg.color}`}>
                      {cfg.label}
                    </p>
                    <p className="mt-0.5 text-[11px] text-zinc-600">
                      {dep.deployedAt}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Ressourcen-Auslastung */}
        <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#172128]/90 shadow-[0_12px_32px_rgba(0,0,0,.1)]">
          <div className="border-b border-white/[0.06] px-5 py-4">
            <h2 className="text-sm font-semibold text-zinc-100">Ressourcen</h2>
            <p className="mt-0.5 text-xs text-zinc-500">Cluster-Auslastung</p>
          </div>
          <div className="space-y-5 p-5">
            <GaugeBar
              label="CPU"
              value={stats?.cpuUsage ?? 0}
              color="bg-[#0984e3]"
            />
            <GaugeBar
              label="Arbeitsspeicher"
              value={stats?.memoryUsage ?? 0}
              color="bg-[#00cec9]"
            />
            <div className="mt-4 rounded-xl border border-white/[0.05] bg-white/[0.025] p-3.5">
              <div className="flex items-center gap-2">
                <Server className="h-3.5 w-3.5 text-zinc-500" />
                <span className="text-xs text-zinc-500">Infrastruktur</span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {[
                  { label: "Nodes", value: "3 / 3" },
                  { label: "Dienste", value: "18" },
                  { label: "Datenbanken", value: "4" },
                  { label: "Domains", value: "7" },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    className="rounded-lg bg-white/[0.035] px-2.5 py-2"
                  >
                    <p className="text-[10px] text-zinc-600">{label}</p>
                    <p className="mt-0.5 text-sm font-semibold text-zinc-200">
                      {value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
