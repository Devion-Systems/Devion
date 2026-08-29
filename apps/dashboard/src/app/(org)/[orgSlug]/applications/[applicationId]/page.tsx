"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Box, GitBranch, Play, Square, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { PageHeader } from "@/components/layout/page-header";
import { ResourceStatusBadge } from "@/components/resources/resource-status-badge";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

type Application = {
  id: string;
  name: string;
  projectId: string;
  defaultEnvironmentId: string | null;
  description: string | null;
  sourceType: "git" | "docker";
  imageName: string | null;
  gitCredentialReference: string | null;
  registryCredentialReference: string | null;
  gitUrl: string | null;
  branch: string;
  status: string;
  lifecycleStatus: "active" | "archived";
  applicationType: string;
};
type Configuration = {
  application: Application;
  build: {
    buildMode: string;
    rootDirectory: string;
    dockerfilePath: string | null;
  } | null;
  runtime: {
    command: string | null;
    workingDirectory: string | null;
    replicas: number;
    restartPolicy: string;
    gracefulShutdownSeconds: number;
    healthcheckCommand: string | null;
    healthcheckIntervalSeconds: number;
    healthcheckTimeoutSeconds: number;
    healthcheckRetries: number;
    healthcheckStartPeriodSeconds: number;
  } | null;
  resources: { cpuMilli: number; memoryMib: number; storageMib: number } | null;
  ports: Array<{
    id: string;
    name: string | null;
    internalPort: number;
    protocol: string;
    exposure: string;
    externalPort: number | null;
  }>;
  volumes: Array<{
    id: string;
    volumeName: string;
    mountPath: string;
    readOnly: boolean;
  }>;
  secrets: Array<{
    id: string;
    key: string;
    targetKey: string;
    environmentId: string | null;
  }>;
  environments: Array<{ id: string; name: string; displayName: string }>;
  applicationVariables: Array<{
    id: string;
    environmentId: string | null;
    key: string;
    value: string;
  }>;
};
type Runtime = {
  status: string;
  deployments: Array<{
    id: string;
    version: number;
    image: string;
    replicas: number;
    desiredState: string;
    createdAt: string;
  }>;
  workloads: Array<{
    id: string;
    deploymentId: string;
    actualState: string;
    desiredState: string;
    healthStatus: "none" | "starting" | "healthy" | "unhealthy";
    publishedPorts: Record<string, number>;
    restartCount: number;
  }>;
};
type ActivityEntry = { id: string; action: string; metadata: string | null; createdAt: string; actorName: string | null; actorEmail: string | null };
type WorkloadLogs = { workloads: Array<{ workloadId: string; status: string; logs: string; updatedAt: string | null }> };
type Metrics = { samples: Array<{ timestamp: string; cpuAverage: number | null; cpuMax: number | null; memoryAverageBytes: number; memoryMaxBytes: number; networkRxBytesPerSecond: number; networkTxBytesPerSecond: number; diskReadBytesPerSecond: number; diskWriteBytesPerSecond: number }> };

const api = (path: string) => `${process.env.NEXT_PUBLIC_API_URL ?? ""}${path}`;

export default function ApplicationDetailPage() {
  const { orgSlug, applicationId } = useParams<{
    orgSlug: string;
    applicationId: string;
  }>();
  const client = useQueryClient();
  const [cpuMilli, setCpuMilli] = useState("250");
  const [memoryMib, setMemoryMib] = useState("256");
  const [storageMib, setStorageMib] = useState("0");
  const [replicas, setReplicas] = useState("1");
  const [restartPolicy, setRestartPolicy] = useState("unless-stopped");
  const [gracefulShutdownSeconds, setGracefulShutdownSeconds] = useState("15");
  const [runtimeCommand, setRuntimeCommand] = useState("");
  const [workingDirectory, setWorkingDirectory] = useState("");
  const [healthcheckCommand, setHealthcheckCommand] = useState("");
  const [healthcheckIntervalSeconds, setHealthcheckIntervalSeconds] =
    useState("30");
  const [healthcheckTimeoutSeconds, setHealthcheckTimeoutSeconds] =
    useState("5");
  const [healthcheckRetries, setHealthcheckRetries] = useState("3");
  const [healthcheckStartPeriodSeconds, setHealthcheckStartPeriodSeconds] =
    useState("0");
  const [newPort, setNewPort] = useState("3000");
  const [newProtocol, setNewProtocol] = useState("tcp");
  const [newExposure, setNewExposure] = useState("private");
  const [newExternalPort, setNewExternalPort] = useState("");
  const [newVolumeName, setNewVolumeName] = useState("");
  const [newMountPath, setNewMountPath] = useState("/data");
  const [newVolumeReadOnly, setNewVolumeReadOnly] = useState(false);
  const [defaultEnvironmentId, setDefaultEnvironmentId] = useState("");
  const [secretEnvironmentId, setSecretEnvironmentId] = useState("");
  const [secretVariableId, setSecretVariableId] = useState("");
  const [secretTargetKey, setSecretTargetKey] = useState("");
  const [rootDirectory, setRootDirectory] = useState(".");
  const [dockerfilePath, setDockerfilePath] = useState("Dockerfile");
  const [newVariableKey, setNewVariableKey] = useState("");
  const [newVariableValue, setNewVariableValue] = useState("");
  const [newVariableEnvironmentId, setNewVariableEnvironmentId] = useState("");
  const [sourceReference, setSourceReference] = useState("");
  const [sourceBranch, setSourceBranch] = useState("main");
  const [gitCredentialReference, setGitCredentialReference] = useState("");
  const [registryCredentialReference, setRegistryCredentialReference] = useState("");
  const [metricsRange, setMetricsRange] = useState<"15m" | "1h" | "6h" | "24h" | "7d">("1h");
  const [metricsWorkloadId, setMetricsWorkloadId] = useState("");
  const [metricsDeploymentId, setMetricsDeploymentId] = useState("");
  const applications = useQuery<Application[]>({
    queryKey: ["org", orgSlug, "applications"],
    queryFn: async () => {
      const response = await fetch(
        api(`/organizations/${orgSlug}/applications`),
        { credentials: "include" },
      );
      if (!response.ok)
        throw new Error("Anwendung konnte nicht geladen werden");
      return response.json();
    },
  });
  const application = applications.data?.find(
    (item) => item.id === applicationId,
  );
  const configuration = useQuery<Configuration>({
    enabled: Boolean(application),
    queryKey: ["application", applicationId, "configuration"],
    queryFn: async () => {
      const response = await fetch(
        api(
          `/organizations/${orgSlug}/projects/${application!.projectId}/applications/${applicationId}/configuration`,
        ),
        { credentials: "include" },
      );
      if (!response.ok)
        throw new Error("Konfiguration konnte nicht geladen werden");
      return response.json();
    },
  });
  const secretVariables = useQuery<
    Array<{ id: string; key: string; isSecret: boolean }>
  >({
    enabled: Boolean(application && secretEnvironmentId),
    queryKey: [
      "application",
      applicationId,
      "secret-variables",
      secretEnvironmentId,
    ],
    queryFn: async () => {
      const response = await fetch(
        api(
          `/organizations/${orgSlug}/projects/${application!.projectId}/environments/${secretEnvironmentId}/variables`,
        ),
        { credentials: "include" },
      );
      if (!response.ok)
        throw new Error("Secret-Metadaten konnten nicht geladen werden");
      const variables = await response.json();
      return variables.filter((item: { isSecret: boolean }) => item.isSecret);
    },
  });
  const runtime = useQuery<Runtime>({
    enabled: Boolean(application),
    queryKey: ["application", applicationId, "runtime"],
    queryFn: async () => {
      const response = await fetch(
        api(
          `/organizations/${orgSlug}/projects/${application!.projectId}/applications/${applicationId}/runtime`,
        ),
        { credentials: "include" },
      );
      if (!response.ok)
        throw new Error("Laufzeitdaten konnten nicht geladen werden");
      return response.json();
    },
  });
  const activity = useQuery<ActivityEntry[]>({
    enabled: Boolean(application),
    queryKey: ["application", applicationId, "activity"],
    queryFn: async () => {
      const response = await fetch(api(`/organizations/${orgSlug}/projects/${application!.projectId}/applications/${applicationId}/activity`), { credentials: "include" });
      if (!response.ok) throw new Error("Aktivität konnte nicht geladen werden");
      return response.json();
    },
  });
  const logs = useQuery<WorkloadLogs>({
    enabled: Boolean(application),
    queryKey: ["application", applicationId, "logs"],
    refetchInterval: 5_000,
    queryFn: async () => {
      const response = await fetch(api(`/organizations/${orgSlug}/projects/${application!.projectId}/applications/${applicationId}/logs?tail=500`), { credentials: "include" });
      if (!response.ok) throw new Error("Logs konnten nicht geladen werden");
      return response.json();
    },
  });
  const metrics = useQuery<Metrics>({
    enabled: Boolean(application),
    queryKey: ["application", applicationId, "metrics", metricsRange, metricsDeploymentId, metricsWorkloadId],
    refetchInterval: 30_000,
    queryFn: async () => {
      const response = await fetch(api(`/organizations/${orgSlug}/projects/${application!.projectId}/applications/${applicationId}/metrics?range=${metricsRange}${metricsDeploymentId ? `&deploymentId=${metricsDeploymentId}` : ""}${metricsWorkloadId ? `&workloadId=${metricsWorkloadId}` : ""}`), { credentials: "include" });
      if (!response.ok) throw new Error("Metriken konnten nicht geladen werden");
      return response.json();
    },
  });
  const deployment = useMutation({
    mutationFn: async (action: "deploy" | "stop") => {
      const response = await fetch(
        api(
          `/organizations/${orgSlug}/projects/${application!.projectId}/applications/${applicationId}/${action}`,
        ),
        {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: "{}",
        },
      );
      if (!response.ok)
        throw new Error(
          (await response.json().catch(() => null))?.error ??
            "Aktion fehlgeschlagen",
        );
    },
    onSuccess: () => {
      void client.invalidateQueries({
        queryKey: ["application", applicationId],
      });
      void client.invalidateQueries({
        queryKey: ["org", orgSlug, "applications"],
      });
    },
  });
  useEffect(() => {
    if (configuration.data?.resources) {
      setCpuMilli(String(configuration.data.resources.cpuMilli));
      setMemoryMib(String(configuration.data.resources.memoryMib));
      setStorageMib(String(configuration.data.resources.storageMib));
    }
    if (configuration.data?.runtime) {
      setReplicas(String(configuration.data.runtime.replicas));
      setRestartPolicy(configuration.data.runtime.restartPolicy);
      setGracefulShutdownSeconds(
        String(configuration.data.runtime.gracefulShutdownSeconds),
      );
      setRuntimeCommand(configuration.data.runtime.command ?? "");
      setWorkingDirectory(configuration.data.runtime.workingDirectory ?? "");
      setHealthcheckCommand(
        configuration.data.runtime.healthcheckCommand ?? "",
      );
      setHealthcheckIntervalSeconds(
        String(configuration.data.runtime.healthcheckIntervalSeconds),
      );
      setHealthcheckTimeoutSeconds(
        String(configuration.data.runtime.healthcheckTimeoutSeconds),
      );
      setHealthcheckRetries(
        String(configuration.data.runtime.healthcheckRetries),
      );
      setHealthcheckStartPeriodSeconds(
        String(configuration.data.runtime.healthcheckStartPeriodSeconds),
      );
    }
    if (configuration.data?.build) {
      setRootDirectory(configuration.data.build.rootDirectory);
      setDockerfilePath(
        configuration.data.build.dockerfilePath ?? "Dockerfile",
      );
    }
    setDefaultEnvironmentId(
      configuration.data?.application.defaultEnvironmentId ?? "",
    );
    if (
      !secretEnvironmentId &&
      configuration.data?.application.defaultEnvironmentId
    )
      setSecretEnvironmentId(
        configuration.data.application.defaultEnvironmentId,
      );
  }, [configuration.data, secretEnvironmentId]);
  useEffect(() => {
    if (application) {
      setSourceReference(application.gitUrl ?? application.imageName ?? "");
      setSourceBranch(application.branch);
      setGitCredentialReference(application.gitCredentialReference ?? "");
      setRegistryCredentialReference(application.registryCredentialReference ?? "");
    }
  }, [application]);
  const saveDefaults = useMutation({
    mutationFn: async () => {
      const resources = {
        cpuMilli: Number(cpuMilli),
        memoryMib: Number(memoryMib),
        storageMib: Number(storageMib),
      };
      const runtimeDefaults = {
        runtime: "container",
        replicas: Number(replicas),
        restartPolicy,
        gracefulShutdownSeconds: Number(gracefulShutdownSeconds),
        command: runtimeCommand.trim() || null,
        workingDirectory: workingDirectory.trim() || null,
        healthcheckCommand: healthcheckCommand.trim() || null,
        healthcheckIntervalSeconds: Number(healthcheckIntervalSeconds),
        healthcheckTimeoutSeconds: Number(healthcheckTimeoutSeconds),
        healthcheckRetries: Number(healthcheckRetries),
        healthcheckStartPeriodSeconds: Number(healthcheckStartPeriodSeconds),
      };
      const [resourceResponse, runtimeResponse] = await Promise.all([
        fetch(
          api(
            `/organizations/${orgSlug}/projects/${application!.projectId}/applications/${applicationId}/resources`,
          ),
          {
            method: "PUT",
            credentials: "include",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(resources),
          },
        ),
        fetch(
          api(
            `/organizations/${orgSlug}/projects/${application!.projectId}/applications/${applicationId}/runtime-configuration`,
          ),
          {
            method: "PUT",
            credentials: "include",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(runtimeDefaults),
          },
        ),
      ]);
      if (!resourceResponse.ok || !runtimeResponse.ok) {
        const body = await (resourceResponse.ok
          ? runtimeResponse
          : resourceResponse
        )
          .json()
          .catch(() => null);
        throw new Error(
          body?.error ?? "Defaults konnten nicht gespeichert werden",
        );
      }
    },
    onSuccess: () =>
      void client.invalidateQueries({
        queryKey: ["application", applicationId, "configuration"],
      }),
  });
  const savePorts = useMutation({
    mutationFn: async (ports: Configuration["ports"]) => {
      const response = await fetch(
        api(
          `/organizations/${orgSlug}/projects/${application!.projectId}/applications/${applicationId}/ports`,
        ),
        {
          method: "PUT",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(
            ports.map((port) => ({
              name: port.name,
              internalPort: port.internalPort,
              protocol: port.protocol,
              exposure: port.exposure,
              externalPort: port.externalPort,
            })),
          ),
        },
      );
      if (!response.ok)
        throw new Error(
          (await response.json().catch(() => null))?.error ??
            "Ports konnten nicht gespeichert werden",
        );
    },
    onSuccess: () =>
      void client.invalidateQueries({
        queryKey: ["application", applicationId, "configuration"],
      }),
  });
  const volumeMutation = useMutation({
    mutationFn: async ({
      action,
      id,
    }: {
      action: "add" | "remove";
      id?: string;
    }) => {
      const response = await fetch(
        api(
          `/organizations/${orgSlug}/projects/${application!.projectId}/applications/${applicationId}/volumes${action === "remove" ? `/${id}` : ""}`,
        ),
        action === "add"
          ? {
              method: "POST",
              credentials: "include",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                volumeName: newVolumeName,
                mountPath: newMountPath,
                readOnly: newVolumeReadOnly,
              }),
            }
          : { method: "DELETE", credentials: "include" },
      );
      if (!response.ok)
        throw new Error(
          (await response.json().catch(() => null))?.error ??
            "Volume-Mount konnte nicht gespeichert werden",
        );
    },
    onSuccess: () => {
      setNewVolumeName("");
      void client.invalidateQueries({
        queryKey: ["application", applicationId, "configuration"],
      });
    },
  });
  const secretMutation = useMutation({
    mutationFn: async ({
      action,
      id,
    }: {
      action: "add" | "remove";
      id?: string;
    }) => {
      const response = await fetch(
        api(
          `/organizations/${orgSlug}/projects/${application!.projectId}/applications/${applicationId}/secrets${action === "remove" ? `/${id}` : ""}`,
        ),
        action === "add"
          ? {
              method: "POST",
              credentials: "include",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                environmentId: secretEnvironmentId,
                secretEnvironmentVariableId: secretVariableId,
                targetKey: secretTargetKey,
              }),
            }
          : { method: "DELETE", credentials: "include" },
      );
      if (!response.ok)
        throw new Error(
          (await response.json().catch(() => null))?.error ??
            "Secret-Attachment konnte nicht gespeichert werden",
        );
    },
    onSuccess: () => {
      setSecretVariableId("");
      setSecretTargetKey("");
      void client.invalidateQueries({
        queryKey: ["application", applicationId, "configuration"],
      });
    },
  });
  const buildConfigurationMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(
        api(
          `/organizations/${orgSlug}/projects/${application!.projectId}/applications/${applicationId}/build-configuration`,
        ),
        {
          method: "PUT",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            buildMode: "dockerfile",
            runtime: "container",
            rootDirectory,
            dockerfilePath,
            buildContext: rootDirectory,
          }),
        },
      );
      if (!response.ok)
        throw new Error(
          (await response.json().catch(() => null))?.error ??
            "Build-Konfiguration konnte nicht gespeichert werden",
        );
    },
    onSuccess: () =>
      void client.invalidateQueries({
        queryKey: ["application", applicationId, "configuration"],
      }),
  });
  const defaultEnvironmentMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(
        api(
          `/organizations/${orgSlug}/projects/${application!.projectId}/applications/${applicationId}`,
        ),
        {
          method: "PATCH",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            defaultEnvironmentId: defaultEnvironmentId || null,
          }),
        },
      );
      if (!response.ok)
        throw new Error(
          (await response.json().catch(() => null))?.error ??
            "Standard-Environment konnte nicht gespeichert werden",
        );
    },
    onSuccess: () => {
      void client.invalidateQueries({
        queryKey: ["application", applicationId, "configuration"],
      });
      void client.invalidateQueries({
        queryKey: ["org", orgSlug, "applications"],
      });
    },
  });
  const applicationVariableMutation = useMutation({
    mutationFn: async ({
      action,
      variable,
    }: {
      action: "save" | "remove";
      variable?: Configuration["applicationVariables"][number];
    }) => {
      const key = action === "save" ? newVariableKey : variable!.key;
      const scope =
        action === "save"
          ? newVariableEnvironmentId
          : (variable!.environmentId ?? "");
      const response = await fetch(
        api(
          `/organizations/${orgSlug}/projects/${application!.projectId}/applications/${applicationId}/variables/${encodeURIComponent(key)}${action === "remove" && scope ? `?environmentId=${encodeURIComponent(scope)}` : ""}`,
        ),
        action === "save"
          ? {
              method: "PUT",
              credentials: "include",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                environmentId: scope || null,
                value: newVariableValue,
              }),
            }
          : { method: "DELETE", credentials: "include" },
      );
      if (!response.ok)
        throw new Error(
          (await response.json().catch(() => null))?.error ??
            "Application-Variable konnte nicht gespeichert werden",
        );
    },
    onSuccess: () => {
      setNewVariableKey("");
      setNewVariableValue("");
      void client.invalidateQueries({
        queryKey: ["application", applicationId, "configuration"],
      });
    },
  });
  const sourceMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(
        api(
          `/organizations/${orgSlug}/projects/${application!.projectId}/applications/${applicationId}`,
        ),
        {
          method: "PATCH",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(
            application!.sourceType === "git"
              ? { gitUrl: sourceReference, branch: sourceBranch, gitCredentialReference: gitCredentialReference || null }
              : { imageName: sourceReference, registryCredentialReference: registryCredentialReference || null },
          ),
        },
      );
      if (!response.ok)
        throw new Error(
          (await response.json().catch(() => null))?.error ??
            "Source konnte nicht gespeichert werden",
        );
    },
    onSuccess: () => {
      void client.invalidateQueries({
        queryKey: ["org", orgSlug, "applications"],
      });
      void client.invalidateQueries({
        queryKey: ["application", applicationId, "configuration"],
      });
    },
  });

  if (applications.isLoading)
    return (
      <div className="space-y-4 p-6">
        <div className="h-9 w-72 animate-pulse rounded bg-white/[0.06]" />
        <div className="h-64 animate-pulse rounded-2xl bg-white/[0.04]" />
      </div>
    );
  if (!application)
    return (
      <div className="space-y-4 p-6">
        <PageHeader
          title="Anwendung nicht gefunden"
          description="Die Anwendung ist nicht verfügbar oder du hast keinen Zugriff."
        />
        <Button asChild variant="outline">
          <Link href={`/${orgSlug}/applications`}>
            <ArrowLeft className="size-4" />
            Zurück zu Applications
          </Link>
        </Button>
      </div>
    );
  const running =
    runtime.data?.workloads.some(
      (workload) =>
        workload.actualState === "running" ||
        workload.desiredState === "running",
    ) ?? false;
  const config = configuration.data;
  const metricChartData = (metrics.data?.samples ?? []).map((sample) => ({
    time: new Date(sample.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    cpu: sample.cpuAverage,
    memoryMiB: sample.memoryAverageBytes / 1024 / 1024,
  }));
  return (
    <div className="space-y-6 p-5 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href={`/${orgSlug}/applications`}
            className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-200"
          >
            <ArrowLeft className="size-3.5" />
            Applications
          </Link>
          <div className="mt-3 flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-zinc-100">
              {application.name}
            </h1>
            <ResourceStatusBadge
              status={
                application.lifecycleStatus === "archived"
                  ? "stopped"
                  : (runtime.data?.status ?? application.status)
              }
            />
          </div>
          <p className="mt-2 text-sm text-zinc-500">
            {application.description ?? "Keine Beschreibung"}
          </p>
        </div>
        <div className="flex gap-2">
          {application.lifecycleStatus === "active" ? (
            <Button
              onClick={() => deployment.mutate(running ? "stop" : "deploy")}
              disabled={deployment.isPending}
            >
              {running ? (
                <Square className="size-4" />
              ) : (
                <Play className="size-4" />
              )}
              {running ? "Stoppen" : "Deploy"}
            </Button>
          ) : null}
          {application.sourceType === "docker" ? (
            <label className="mt-3 block text-xs text-zinc-400">
              Registry-Credential <span className="text-zinc-600">(optional, JSON mit username und password)</span>
              <select
                value={registryCredentialReference}
                onChange={(event) => setRegistryCredentialReference(event.target.value)}
                className="mt-1.5 h-9 w-full rounded-lg border border-white/[0.1] bg-[#0b1217] px-2.5 text-xs text-zinc-100"
              >
                <option value="">Kein Credential</option>
                {secretVariables.data?.map((variable: { id: string; key: string }) => (
                  <option key={variable.id} value={variable.id}>{variable.key}</option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      </div>
      {deployment.error || configuration.error || runtime.error ? (
        <p
          role="alert"
          className="rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-sm text-red-200"
        >
          {deployment.error?.message ??
            configuration.error?.message ??
            runtime.error?.message}
        </p>
      ) : null}
      <section className="grid gap-4 lg:grid-cols-3">
        <article className="rounded-2xl border border-white/[0.08] bg-[#172128] p-5">
          <p className="text-xs uppercase tracking-wide text-zinc-500">
            Source
          </p>
          <p className="mt-3 inline-flex items-center gap-2 font-medium text-zinc-100">
            {application.sourceType === "git" ? (
              <GitBranch className="size-4 text-[#81ecec]" />
            ) : (
              <Box className="size-4 text-[#81ecec]" />
            )}
            {application.sourceType === "git" ? "Git Repository" : "OCI Image"}
          </p>
          <label className="mt-3 block text-xs text-zinc-400">
            {application.sourceType === "git" ? "Repository URL" : "OCI Image"}
            <input
              value={sourceReference}
              onChange={(event) => setSourceReference(event.target.value)}
              className="mt-1.5 h-9 w-full rounded-lg border border-white/[0.1] bg-[#0b1217] px-2.5 font-mono text-xs text-zinc-100"
            />
          </label>
          {application.sourceType === "git" ? (
            <>
              <label className="mt-3 block text-xs text-zinc-400">
                Branch
                <input
                  value={sourceBranch}
                  onChange={(event) => setSourceBranch(event.target.value)}
                  className="mt-1.5 h-9 w-full rounded-lg border border-white/[0.1] bg-[#0b1217] px-2.5 font-mono text-xs text-zinc-100"
                />
              </label>
              <label className="mt-3 block text-xs text-zinc-400">
                Git-Credential <span className="text-zinc-600">(optional)</span>
                <select
                  value={gitCredentialReference}
                  onChange={(event) => setGitCredentialReference(event.target.value)}
                  className="mt-1.5 h-9 w-full rounded-lg border border-white/[0.1] bg-[#0b1217] px-2.5 text-xs text-zinc-100"
                >
                  <option value="">Kein Credential</option>
                  {secretVariables.data?.map((variable: { id: string; key: string }) => (
                    <option key={variable.id} value={variable.id}>{variable.key}</option>
                  ))}
                </select>
              </label>
            </>
          ) : null}
          <Button
            size="sm"
            className="mt-3"
            onClick={() => sourceMutation.mutate()}
            disabled={
              !sourceReference ||
              (application.sourceType === "git" && !sourceBranch) ||
              sourceMutation.isPending ||
              application.lifecycleStatus === "archived"
            }
          >
            {sourceMutation.isPending ? "Speichert …" : "Source speichern"}
          </Button>
          {sourceMutation.error ? (
            <p role="alert" className="mt-2 text-xs text-red-300">
              {sourceMutation.error.message}
            </p>
          ) : null}
        </article>
        <article className="rounded-2xl border border-white/[0.08] bg-[#172128] p-5">
          <p className="text-xs uppercase tracking-wide text-zinc-500">
            Resources
          </p>
          <p className="mt-3 text-lg font-semibold text-zinc-100">
            {config?.resources
              ? `${config.resources.cpuMilli / 1000} CPU · ${config.resources.memoryMib} MiB`
              : "Standardwerte"}
          </p>
          <p className="mt-2 text-xs text-zinc-500">
            {config?.runtime?.replicas ?? 1} gewünschte Replika(s)
          </p>
        </article>
        <article className="rounded-2xl border border-white/[0.08] bg-[#172128] p-5">
          <p className="text-xs uppercase tracking-wide text-zinc-500">
            Health
          </p>
          <p className="mt-3 text-lg font-semibold text-zinc-100">
            {runtime.data?.workloads.filter(
              (workload) =>
                workload.healthStatus === "healthy" ||
                (workload.healthStatus === "none" &&
                  workload.actualState === "running"),
            ).length ?? 0}{" "}
            / {config?.runtime?.replicas ?? 1} bereit
          </p>
          <p className="mt-2 text-xs text-zinc-500">
            {runtime.data?.workloads.some(
              (workload) => workload.healthStatus === "unhealthy",
            )
              ? "Agent meldet mindestens einen ungesunden Container"
              : "Nur vom Agent gemeldete Workloads"}
          </p>
        </article>
      </section>
      <section className="rounded-2xl border border-white/[0.08] bg-[#172128] p-5">
        <div className="flex items-baseline justify-between gap-3">
          <div><h2 className="font-medium text-zinc-100">Workload-Metriken</h2><p className="mt-1 text-sm text-zinc-500">Vom Docker-Agenten gemeldet.</p></div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400"><label>Deployment <select value={metricsDeploymentId} onChange={(event) => { setMetricsDeploymentId(event.target.value); setMetricsWorkloadId(""); }} className="ml-1 max-w-36 rounded border border-white/[0.1] bg-[#0b1217] px-2 py-1 font-mono text-zinc-200"><option value="">Alle</option>{runtime.data?.deployments.map((deployment) => <option key={deployment.id} value={deployment.id}>v{deployment.version}</option>)}</select></label><label>Workload <select value={metricsWorkloadId} onChange={(event) => setMetricsWorkloadId(event.target.value)} className="ml-1 max-w-36 rounded border border-white/[0.1] bg-[#0b1217] px-2 py-1 font-mono text-zinc-200"><option value="">Alle</option>{runtime.data?.workloads.filter((workload) => !metricsDeploymentId || workload.deploymentId === metricsDeploymentId).map((workload) => <option key={workload.id} value={workload.id}>{workload.id.slice(0, 8)}</option>)}</select></label><label>Zeitraum <select value={metricsRange} onChange={(event) => setMetricsRange(event.target.value as typeof metricsRange)} className="ml-1 rounded border border-white/[0.1] bg-[#0b1217] px-2 py-1 text-zinc-200"><option value="15m">15 Min.</option><option value="1h">1 Std.</option><option value="6h">6 Std.</option><option value="24h">24 Std.</option><option value="7d">7 Tage</option></select></label></div>
        </div>
        {metrics.isLoading ? <p className="mt-4 text-sm text-zinc-500">Metriken werden geladen …</p> : null}
        {metrics.error ? <p role="alert" className="mt-4 text-sm text-red-300">{metrics.error.message}</p> : null}
        {!metrics.isLoading && !metrics.error && !(metrics.data?.samples.length) ? <p className="mt-4 text-sm text-zinc-500">Keine Metriken für diesen Zeitraum vorhanden.</p> : null}
        {metrics.data?.samples.length ? (() => { const latest = metrics.data.samples.at(-1)!; const cpu = latest.cpuAverage === null ? "—" : `${latest.cpuAverage.toFixed(1)} %`; const mib = latest.memoryAverageBytes / 1024 / 1024; const net = (latest.networkRxBytesPerSecond + latest.networkTxBytesPerSecond) / 1024; const disk = (latest.diskReadBytesPerSecond + latest.diskWriteBytesPerSecond) / 1024; return <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><div className="rounded-xl bg-white/[0.035] p-3"><p className="text-xs text-zinc-500">CPU</p><p className="mt-1 text-lg font-semibold text-zinc-100">{cpu}</p></div><div className="rounded-xl bg-white/[0.035] p-3"><p className="text-xs text-zinc-500">Arbeitsspeicher</p><p className="mt-1 text-lg font-semibold text-zinc-100">{mib.toFixed(1)} MiB</p></div><div className="rounded-xl bg-white/[0.035] p-3"><p className="text-xs text-zinc-500">Netzwerk</p><p className="mt-1 text-lg font-semibold text-zinc-100">{net.toFixed(1)} KiB/s</p></div><div className="rounded-xl bg-white/[0.035] p-3"><p className="text-xs text-zinc-500">Datenträger-I/O</p><p className="mt-1 text-lg font-semibold text-zinc-100">{disk.toFixed(1)} KiB/s</p></div></div>; })() : null}
        {metrics.data?.samples.length ? (() => { const latest = metrics.data.samples.at(-1)!; return <div className="mt-3 grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-white/[0.035] p-3"><p className="text-xs text-zinc-500">Netzwerk RX</p><p className="mt-1 text-lg font-semibold text-zinc-100">{(latest.networkRxBytesPerSecond / 1024).toFixed(1)} KiB/s</p></div><div className="rounded-xl bg-white/[0.035] p-3"><p className="text-xs text-zinc-500">Netzwerk TX</p><p className="mt-1 text-lg font-semibold text-zinc-100">{(latest.networkTxBytesPerSecond / 1024).toFixed(1)} KiB/s</p></div></div>; })() : null}
      </section>
      {metricChartData.length > 1 ? <ChartContainer className="-mt-5 h-56 w-full" config={{ cpu: { label: "CPU", color: "#00cec9" }, memoryMiB: { label: "Arbeitsspeicher", color: "#74b9ff" } }}><AreaChart data={metricChartData}><defs><linearGradient id="metric-cpu" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#00cec9" stopOpacity={0.35} /><stop offset="95%" stopColor="#00cec9" stopOpacity={0} /></linearGradient><linearGradient id="metric-memory" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#74b9ff" stopOpacity={0.25} /><stop offset="95%" stopColor="#74b9ff" stopOpacity={0} /></linearGradient></defs><CartesianGrid vertical={false} stroke="rgba(255,255,255,0.08)" /><XAxis dataKey="time" tickLine={false} axisLine={false} minTickGap={24} /><YAxis yAxisId="cpu" tickLine={false} axisLine={false} width={40} tickFormatter={(value) => `${value}%`} /><YAxis yAxisId="memory" orientation="right" tickLine={false} axisLine={false} width={52} tickFormatter={(value) => `${value}M`} /><ChartTooltip content={<ChartTooltipContent />} /><Area yAxisId="cpu" type="monotone" dataKey="cpu" stroke="#00cec9" fill="url(#metric-cpu)" connectNulls /><Area yAxisId="memory" type="monotone" dataKey="memoryMiB" stroke="#74b9ff" fill="url(#metric-memory)" /></AreaChart></ChartContainer> : null}
      <section className="grid gap-4 xl:grid-cols-2">
        <article className="rounded-2xl border border-white/[0.08] bg-[#172128] p-5">
          <h2 className="font-medium text-zinc-100">Deployments</h2>
          <div className="mt-4 space-y-3">
            {runtime.data?.deployments.length ? (
              runtime.data.deployments.map((item) => (
                <Link
                  key={item.id}
                  href={`/${orgSlug}/projects/${application.projectId}/deployments/${item.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.035] px-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-zinc-200">
                      Version {item.version}
                    </p>
                    <p className="truncate font-mono text-xs text-zinc-500">
                      {item.image}
                    </p>
                  </div>
                  <span className="text-xs text-zinc-400">
                    {item.replicas} replicas
                  </span>
                </Link>
              ))
            ) : (
              <p className="text-sm text-zinc-500">
                Noch kein Deployment vorhanden.
              </p>
            )}
          </div>
        </article>
        <article className="rounded-2xl border border-white/[0.08] bg-[#172128] p-5">
          <h2 className="font-medium text-zinc-100">Networking & Storage</h2>
          <div className="mt-4 space-y-3 text-sm">
            {config?.ports.length ? (
              config.ports.map((port) => (
                <p
                  key={port.id}
                  className="rounded-xl bg-white/[0.035] px-3 py-2 text-zinc-300"
                >
                  {port.name ?? "Port"}: {port.internalPort}/{port.protocol} ·{" "}
                  {port.exposure}
                </p>
              ))
            ) : (
              <p className="text-zinc-500">Keine Ports konfiguriert.</p>
            )}
            {config?.volumes.map((volume) => (
              <p
                key={volume.id}
                className="rounded-xl bg-white/[0.035] px-3 py-2 font-mono text-xs text-zinc-300"
              >
                {volume.volumeName} → {volume.mountPath}
                {volume.readOnly ? " (read-only)" : ""}
              </p>
            ))}
            {runtime.data?.workloads
              .flatMap((workload) =>
                Object.entries(workload.publishedPorts).map(
                  ([containerPort, hostPort]) => ({
                    workloadId: workload.id,
                    containerPort,
                    hostPort,
                  }),
                ),
              )
              .map((port) => (
                <p
                  key={`${port.workloadId}-${port.containerPort}`}
                  className="rounded-xl bg-white/[0.035] px-3 py-2 font-mono text-xs text-[#81ecec]"
                >
                  Public: {port.containerPort} → host:{port.hostPort}
                </p>
              ))}
          </div>
        </article>
      </section>
      <section className="rounded-2xl border border-white/[0.08] bg-[#172128] p-5">
        <h2 className="font-medium text-zinc-100">Aktivität</h2>
        <div className="mt-4 divide-y divide-white/[0.06]">
          {activity.isLoading ? <p className="py-4 text-sm text-zinc-500">Aktivität wird geladen …</p> : null}
          {activity.data?.map((entry) => (
            <article key={entry.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
              <div><p className="font-mono text-zinc-200">{entry.action}</p><p className="mt-1 text-xs text-zinc-500">{entry.actorName ?? entry.actorEmail ?? "System"}</p></div>
              <time className="text-xs text-zinc-600">{new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(entry.createdAt))}</time>
            </article>
          ))}
          {!activity.isLoading && !activity.data?.length ? <p className="py-4 text-sm text-zinc-500">Noch keine Application-Aktivität vorhanden.</p> : null}
        </div>
      </section>
      <section className="rounded-2xl border border-white/[0.08] bg-[#172128] p-5">
        <h2 className="font-medium text-zinc-100">Workload-Logs</h2>
        {logs.isError ? <p role="alert" className="mt-3 text-sm text-red-300">{logs.error.message}</p> : null}
        {!logs.isError && !logs.data?.workloads.length ? <p className="mt-3 text-sm text-zinc-500">Keine laufenden Workloads.</p> : null}
        <div className="mt-4 space-y-4">
          {logs.data?.workloads.map((workload) => <article key={workload.workloadId}><p className="mb-2 font-mono text-xs text-zinc-500">{workload.workloadId.slice(0, 8)} · {workload.status}</p><pre className="max-h-80 overflow-auto rounded-xl bg-[#080d10] p-3 font-mono text-xs leading-5 text-zinc-300">{workload.logs || "Logs werden vom Agenten abgefragt …"}</pre></article>)}
        </div>
      </section>
      <section className="rounded-2xl border border-white/[0.08] bg-[#172128] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-medium text-zinc-100">Runtime Command</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Optionaler Shell-Command und Arbeitsverzeichnis für den nächsten
              Containerstart.
            </p>
          </div>
          <Button
            onClick={() => saveDefaults.mutate()}
            disabled={
              saveDefaults.isPending ||
              application.lifecycleStatus === "archived"
            }
          >
            {saveDefaults.isPending ? "Speichert …" : "Runtime speichern"}
          </Button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm text-zinc-300">
            Command
            <input
              value={runtimeCommand}
              onChange={(event) => setRuntimeCommand(event.target.value)}
              placeholder="node server.js"
              className="mt-1.5 h-10 w-full rounded-xl border border-white/[0.1] bg-[#0b1217] px-3 font-mono text-sm text-zinc-100"
            />
          </label>
          <label className="text-sm text-zinc-300">
            Working Directory
            <input
              value={workingDirectory}
              onChange={(event) => setWorkingDirectory(event.target.value)}
              placeholder="/app"
              className="mt-1.5 h-10 w-full rounded-xl border border-white/[0.1] bg-[#0b1217] px-3 font-mono text-sm text-zinc-100"
            />
          </label>
        </div>
        {saveDefaults.error ? (
          <p role="alert" className="mt-3 text-sm text-red-300">
            {saveDefaults.error.message}
          </p>
        ) : null}
      </section>
      <section className="rounded-2xl border border-white/[0.08] bg-[#172128] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-medium text-zinc-100">Ports</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Öffentlichkeit und Protokoll werden serverseitig validiert.
            </p>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          {config?.ports.map((port) => (
            <div
              key={port.id}
              className="flex items-center justify-between rounded-xl bg-white/[0.035] px-3 py-2 text-sm text-zinc-300"
            >
              <span>
                {port.name ?? "Port"}: {port.internalPort}/{port.protocol} ·{" "}
                {port.exposure}
              </span>
              <Button
                size="icon"
                variant="ghost"
                className="size-8 text-zinc-400 hover:text-red-300"
                aria-label={`Port ${port.internalPort} entfernen`}
                onClick={() =>
                  savePorts.mutate(
                    (config?.ports ?? []).filter((item) => item.id !== port.id),
                  )
                }
                disabled={
                  savePorts.isPending ||
                  application.lifecycleStatus === "archived"
                }
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_120px_120px_140px_auto]">
          <input
            aria-label="Interner Port"
            type="number"
            min="1"
            max="65535"
            value={newPort}
            onChange={(event) => setNewPort(event.target.value)}
            className="h-10 rounded-xl border border-white/[0.1] bg-[#0b1217] px-3 text-zinc-100"
          />
          <select
            aria-label="Protokoll"
            value={newProtocol}
            onChange={(event) => setNewProtocol(event.target.value)}
            className="h-10 rounded-xl border border-white/[0.1] bg-[#0b1217] px-3 text-zinc-100"
          >
            <option value="tcp">TCP</option>
            <option value="udp">UDP</option>
          </select>
          <select
            aria-label="Exposure"
            value={newExposure}
            onChange={(event) => setNewExposure(event.target.value)}
            className="h-10 rounded-xl border border-white/[0.1] bg-[#0b1217] px-3 text-zinc-100"
          >
            <option value="private">Private</option>
            <option value="public">Public</option>
          </select>
          <input
            aria-label="Externer Port"
            type="number"
            min="1"
            max="65535"
            value={newExternalPort}
            onChange={(event) => setNewExternalPort(event.target.value)}
            disabled={newExposure !== "public"}
            placeholder="Dynamisch"
            className="h-10 rounded-xl border border-white/[0.1] bg-[#0b1217] px-3 text-zinc-100 disabled:opacity-50"
          />
          <Button
            onClick={() =>
              savePorts.mutate([
                ...(config?.ports ?? []),
                {
                  id: crypto.randomUUID(),
                  name: null,
                  internalPort: Number(newPort),
                  protocol: newProtocol,
                  exposure: newExposure,
                  externalPort: newExposure === "public" && newExternalPort ? Number(newExternalPort) : null,
                },
              ])
            }
            disabled={
              savePorts.isPending || application.lifecycleStatus === "archived"
            }
          >
            Port hinzufügen
          </Button>
        </div>
        {savePorts.error ? (
          <p role="alert" className="mt-3 text-sm text-red-300">
            {savePorts.error.message}
          </p>
        ) : null}
      </section>
      <section className="rounded-2xl border border-white/[0.08] bg-[#172128] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-medium text-zinc-100">Deployment Defaults</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Gelten erst für das nächste Deployment; bestehende Versionen
              bleiben unverändert.
            </p>
          </div>
          <Button
            onClick={() => saveDefaults.mutate()}
            disabled={
              saveDefaults.isPending ||
              application.lifecycleStatus === "archived"
            }
          >
            {saveDefaults.isPending ? "Speichert …" : "Defaults speichern"}
          </Button>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <label className="text-sm text-zinc-300">
            CPU (mCPU)
            <input
              type="number"
              min="1"
              value={cpuMilli}
              onChange={(event) => setCpuMilli(event.target.value)}
              className="mt-1.5 h-10 w-full rounded-xl border border-white/[0.1] bg-[#0b1217] px-3 text-zinc-100"
            />
          </label>
          <label className="text-sm text-zinc-300">
            RAM (MiB)
            <input
              type="number"
              min="16"
              value={memoryMib}
              onChange={(event) => setMemoryMib(event.target.value)}
              className="mt-1.5 h-10 w-full rounded-xl border border-white/[0.1] bg-[#0b1217] px-3 text-zinc-100"
            />
          </label>
          <label className="text-sm text-zinc-300">
            Storage (MiB)
            <input
              type="number"
              min="0"
              value={storageMib}
              onChange={(event) => setStorageMib(event.target.value)}
              className="mt-1.5 h-10 w-full rounded-xl border border-white/[0.1] bg-[#0b1217] px-3 text-zinc-100"
            />
          </label>
          <label className="text-sm text-zinc-300">
            Replicas
            <input
              type="number"
              min="1"
              max="100"
              value={replicas}
              onChange={(event) => setReplicas(event.target.value)}
              className="mt-1.5 h-10 w-full rounded-xl border border-white/[0.1] bg-[#0b1217] px-3 text-zinc-100"
            />
          </label>
          <label className="text-sm text-zinc-300">
            Restart Policy
            <select
              value={restartPolicy}
              onChange={(event) => setRestartPolicy(event.target.value)}
              className="mt-1.5 h-10 w-full rounded-xl border border-white/[0.1] bg-[#0b1217] px-3 text-zinc-100"
            >
              <option value="unless-stopped">unless-stopped</option>
              <option value="always">always</option>
              <option value="on-failure">on-failure</option>
              <option value="no">no</option>
            </select>
          </label>
          <label className="text-sm text-zinc-300">
            Shutdown (Sek.)
            <input
              type="number"
              min="1"
              max="600"
              value={gracefulShutdownSeconds}
              onChange={(event) =>
                setGracefulShutdownSeconds(event.target.value)
              }
              className="mt-1.5 h-10 w-full rounded-xl border border-white/[0.1] bg-[#0b1217] px-3 text-zinc-100"
            />
          </label>
        </div>
        {saveDefaults.error ? (
          <p role="alert" className="mt-4 text-sm text-red-300">
            {saveDefaults.error.message}
          </p>
        ) : null}
      </section>
      <section className="rounded-2xl border border-white/[0.08] bg-[#172128] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-medium text-zinc-100">Health Check</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Docker führt den Shell-Befehl im Container aus. Leer lassen, um
              keinen Healthcheck zu setzen.
            </p>
          </div>
          <Button
            onClick={() => saveDefaults.mutate()}
            disabled={
              saveDefaults.isPending ||
              application.lifecycleStatus === "archived"
            }
          >
            {saveDefaults.isPending ? "Speichert …" : "Healthcheck speichern"}
          </Button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="lg:col-span-2 text-sm text-zinc-300">
            Command
            <input
              value={healthcheckCommand}
              onChange={(event) => setHealthcheckCommand(event.target.value)}
              placeholder="curl -fsS http://localhost:3000/health || exit 1"
              className="mt-1.5 h-10 w-full rounded-xl border border-white/[0.1] bg-[#0b1217] px-3 font-mono text-sm text-zinc-100"
            />
          </label>
          <label className="text-sm text-zinc-300">
            Interval (s)
            <input
              type="number"
              min="1"
              max="3600"
              value={healthcheckIntervalSeconds}
              onChange={(event) =>
                setHealthcheckIntervalSeconds(event.target.value)
              }
              className="mt-1.5 h-10 w-full rounded-xl border border-white/[0.1] bg-[#0b1217] px-3 text-zinc-100"
            />
          </label>
          <label className="text-sm text-zinc-300">
            Timeout (s)
            <input
              type="number"
              min="1"
              max="600"
              value={healthcheckTimeoutSeconds}
              onChange={(event) =>
                setHealthcheckTimeoutSeconds(event.target.value)
              }
              className="mt-1.5 h-10 w-full rounded-xl border border-white/[0.1] bg-[#0b1217] px-3 text-zinc-100"
            />
          </label>
          <label className="text-sm text-zinc-300">
            Retries
            <input
              type="number"
              min="1"
              max="20"
              value={healthcheckRetries}
              onChange={(event) => setHealthcheckRetries(event.target.value)}
              className="mt-1.5 h-10 w-full rounded-xl border border-white/[0.1] bg-[#0b1217] px-3 text-zinc-100"
            />
          </label>
          <label className="text-sm text-zinc-300">
            Start Period (s)
            <input
              type="number"
              min="0"
              max="3600"
              value={healthcheckStartPeriodSeconds}
              onChange={(event) =>
                setHealthcheckStartPeriodSeconds(event.target.value)
              }
              className="mt-1.5 h-10 w-full rounded-xl border border-white/[0.1] bg-[#0b1217] px-3 text-zinc-100"
            />
          </label>
        </div>
        {saveDefaults.error ? (
          <p role="alert" className="mt-3 text-sm text-red-300">
            {saveDefaults.error.message}
          </p>
        ) : null}
      </section>
      <section className="rounded-2xl border border-white/[0.08] bg-[#172128] p-5">
        <h2 className="font-medium text-zinc-100">Volume Mounts</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Named Volumes werden beim nächsten Deployment durch den Agenten
          gemountet.
        </p>
        <div className="mt-4 space-y-2">
          {config?.volumes.map((volume) => (
            <div
              key={volume.id}
              className="flex items-center justify-between rounded-xl bg-white/[0.035] px-3 py-2 text-sm text-zinc-300"
            >
              <span className="font-mono text-xs">
                {volume.volumeName} → {volume.mountPath}
                {volume.readOnly ? " (read-only)" : ""}
              </span>
              <Button
                size="icon"
                variant="ghost"
                className="size-8 text-zinc-400 hover:text-red-300"
                aria-label={`${volume.volumeName} entfernen`}
                onClick={() =>
                  volumeMutation.mutate({ action: "remove", id: volume.id })
                }
                disabled={
                  volumeMutation.isPending ||
                  application.lifecycleStatus === "archived"
                }
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto]">
          <input
            aria-label="Volume-Name"
            value={newVolumeName}
            onChange={(event) => setNewVolumeName(event.target.value)}
            placeholder="app-data"
            className="h-10 rounded-xl border border-white/[0.1] bg-[#0b1217] px-3 text-zinc-100"
          />
          <input
            aria-label="Mount-Pfad"
            value={newMountPath}
            onChange={(event) => setNewMountPath(event.target.value)}
            placeholder="/data"
            className="h-10 rounded-xl border border-white/[0.1] bg-[#0b1217] px-3 text-zinc-100"
          />
          <label className="flex items-center gap-2 text-sm text-zinc-300">
            <input
              type="checkbox"
              checked={newVolumeReadOnly}
              onChange={(event) => setNewVolumeReadOnly(event.target.checked)}
            />
            Read-only
          </label>
          <Button
            onClick={() => volumeMutation.mutate({ action: "add" })}
            disabled={
              !newVolumeName ||
              !newMountPath ||
              volumeMutation.isPending ||
              application.lifecycleStatus === "archived"
            }
          >
            Volume hinzufügen
          </Button>
        </div>
        {volumeMutation.error ? (
          <p role="alert" className="mt-3 text-sm text-red-300">
            {volumeMutation.error.message}
          </p>
        ) : null}
      </section>
      {application.sourceType === "git" ? (
        <section className="rounded-2xl border border-white/[0.08] bg-[#172128] p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-medium text-zinc-100">Build Configuration</h2>
              <p className="mt-1 text-sm text-zinc-500">
                Dockerfile-Builds werden für den nächsten Builder-Run
                eingefroren.
              </p>
            </div>
            <Button
              onClick={() => buildConfigurationMutation.mutate()}
              disabled={
                buildConfigurationMutation.isPending ||
                application.lifecycleStatus === "archived"
              }
            >
              {buildConfigurationMutation.isPending
                ? "Speichert …"
                : "Build speichern"}
            </Button>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-sm text-zinc-300">
              Root Directory
              <input
                value={rootDirectory}
                onChange={(event) => setRootDirectory(event.target.value)}
                className="mt-1.5 h-10 w-full rounded-xl border border-white/[0.1] bg-[#0b1217] px-3 text-zinc-100"
              />
            </label>
            <label className="text-sm text-zinc-300">
              Dockerfile
              <input
                value={dockerfilePath}
                onChange={(event) => setDockerfilePath(event.target.value)}
                className="mt-1.5 h-10 w-full rounded-xl border border-white/[0.1] bg-[#0b1217] px-3 text-zinc-100"
              />
            </label>
          </div>
          {buildConfigurationMutation.error ? (
            <p role="alert" className="mt-3 text-sm text-red-300">
              {buildConfigurationMutation.error.message}
            </p>
          ) : null}
        </section>
      ) : null}
      <section className="rounded-2xl border border-white/[0.08] bg-[#172128] p-5">
        <h2 className="font-medium text-zinc-100">Application Variables</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Nicht geheime Werte. Global gesetzte Werte werden durch einen Override
          des gewählten Environments ersetzt.
        </p>
        <div className="mt-4 space-y-2">
          {config?.applicationVariables.length ? (
            config.applicationVariables.map((variable) => (
              <div
                key={variable.id}
                className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.035] px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-mono text-zinc-200">
                    {variable.key}={variable.value}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {variable.environmentId
                      ? `Override: ${config.environments.find((environment) => environment.id === variable.environmentId)?.displayName ?? variable.environmentId}`
                      : "Application default"}
                  </p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-8 text-zinc-400 hover:text-red-300"
                  aria-label={`${variable.key} entfernen`}
                  onClick={() =>
                    applicationVariableMutation.mutate({
                      action: "remove",
                      variable,
                    })
                  }
                  disabled={
                    applicationVariableMutation.isPending ||
                    application.lifecycleStatus === "archived"
                  }
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))
          ) : (
            <p className="text-sm text-zinc-500">
              Keine Application-Variablen konfiguriert.
            </p>
          )}
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
          <input
            aria-label="Variablenname"
            value={newVariableKey}
            onChange={(event) =>
              setNewVariableKey(event.target.value.toUpperCase())
            }
            placeholder="LOG_LEVEL"
            className="h-10 rounded-xl border border-white/[0.1] bg-[#0b1217] px-3 font-mono text-sm text-zinc-100"
          />
          <input
            aria-label="Variablenwert"
            value={newVariableValue}
            onChange={(event) => setNewVariableValue(event.target.value)}
            placeholder="info"
            className="h-10 rounded-xl border border-white/[0.1] bg-[#0b1217] px-3 text-zinc-100"
          />
          <select
            aria-label="Variable scope"
            value={newVariableEnvironmentId}
            onChange={(event) =>
              setNewVariableEnvironmentId(event.target.value)
            }
            className="h-10 rounded-xl border border-white/[0.1] bg-[#0b1217] px-3 text-zinc-100"
          >
            <option value="">Application default</option>
            {config?.environments.map((environment) => (
              <option key={environment.id} value={environment.id}>
                Override: {environment.displayName || environment.name}
              </option>
            ))}
          </select>
          <Button
            onClick={() =>
              applicationVariableMutation.mutate({ action: "save" })
            }
            disabled={
              !newVariableKey ||
              !newVariableValue ||
              applicationVariableMutation.isPending ||
              application.lifecycleStatus === "archived"
            }
          >
            {applicationVariableMutation.isPending
              ? "Speichert …"
              : "Variable speichern"}
          </Button>
        </div>
        {applicationVariableMutation.error ? (
          <p role="alert" className="mt-3 text-sm text-red-300">
            {applicationVariableMutation.error.message}
          </p>
        ) : null}
      </section>
      <section className="rounded-2xl border border-white/[0.08] bg-[#172128] p-5">
        <h2 className="font-medium text-zinc-100">Environment & Secrets</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Secret-Werte werden niemals geladen oder angezeigt.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-2">
          <label className="min-w-56 text-sm text-zinc-300">
            Standard-Environment
            <select
              value={defaultEnvironmentId}
              onChange={(event) => setDefaultEnvironmentId(event.target.value)}
              className="mt-1.5 h-10 w-full rounded-xl border border-white/[0.1] bg-[#0b1217] px-3 text-zinc-100"
            >
              <option value="">Keines</option>
              {config?.environments.map((environment) => (
                <option key={environment.id} value={environment.id}>
                  {environment.displayName || environment.name}
                </option>
              ))}
            </select>
          </label>
          <Button
            onClick={() => defaultEnvironmentMutation.mutate()}
            disabled={
              defaultEnvironmentMutation.isPending ||
              application.lifecycleStatus === "archived"
            }
          >
            {defaultEnvironmentMutation.isPending
              ? "Speichert …"
              : "Environment speichern"}
          </Button>
        </div>
        {defaultEnvironmentMutation.error ? (
          <p role="alert" className="mt-3 text-sm text-red-300">
            {defaultEnvironmentMutation.error.message}
          </p>
        ) : null}
        <div className="mt-5 flex flex-wrap gap-2">
          {config?.secrets.length ? (
            config.secrets.map((secret) => (
              <span
                key={secret.id}
                className="inline-flex items-center gap-1 rounded-lg border border-[#00cec9]/20 bg-[#00cec9]/5 px-2.5 py-1.5 font-mono text-xs text-[#81ecec]"
              >
                {secret.targetKey} ← {secret.key}
                <button
                  type="button"
                  aria-label={`${secret.targetKey} entfernen`}
                  onClick={() =>
                    secretMutation.mutate({ action: "remove", id: secret.id })
                  }
                  disabled={
                    secretMutation.isPending ||
                    application.lifecycleStatus === "archived"
                  }
                  className="ml-1 text-zinc-400 hover:text-red-300"
                >
                  ×
                </button>
              </span>
            ))
          ) : (
            <span className="text-sm text-zinc-500">
              Keine Secrets angehängt.
            </span>
          )}
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
          <select
            aria-label="Secret Environment"
            value={secretEnvironmentId}
            onChange={(event) => {
              setSecretEnvironmentId(event.target.value);
              setSecretVariableId("");
            }}
            className="h-10 rounded-xl border border-white/[0.1] bg-[#0b1217] px-3 text-zinc-100"
          >
            <option value="">Environment auswählen</option>
            {config?.environments.map((environment) => (
              <option key={environment.id} value={environment.id}>
                {environment.displayName || environment.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Secret auswählen"
            value={secretVariableId}
            onChange={(event) => setSecretVariableId(event.target.value)}
            disabled={!secretEnvironmentId || secretVariables.isLoading}
            className="h-10 rounded-xl border border-white/[0.1] bg-[#0b1217] px-3 text-zinc-100"
          >
            <option value="">Secret auswählen</option>
            {(secretVariables.data ?? []).map((variable) => (
              <option key={variable.id} value={variable.id}>
                {variable.key}
              </option>
            ))}
          </select>
          <input
            aria-label="Zielvariable"
            value={secretTargetKey}
            onChange={(event) =>
              setSecretTargetKey(event.target.value.toUpperCase())
            }
            placeholder="DATABASE_PASSWORD"
            className="h-10 rounded-xl border border-white/[0.1] bg-[#0b1217] px-3 text-zinc-100"
          />
          <Button
            onClick={() => secretMutation.mutate({ action: "add" })}
            disabled={
              !secretEnvironmentId ||
              !secretVariableId ||
              !secretTargetKey ||
              secretMutation.isPending ||
              application.lifecycleStatus === "archived"
            }
          >
            Secret anhängen
          </Button>
        </div>
        {secretMutation.error || secretVariables.error ? (
          <p role="alert" className="mt-3 text-sm text-red-300">
            {secretMutation.error?.message ?? secretVariables.error?.message}
          </p>
        ) : null}
      </section>
    </div>
  );
}
