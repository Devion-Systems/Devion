"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  Globe,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";

type DomainStatus = "active" | "pending" | "failed";
type ProjectDomain = {
  id: string;
  hostname: string;
  environment: string;
  status: DomainStatus;
  sslExpiresAt: string | null;
  createdAt: string;
  applicationId: string | null;
  deploymentId: string | null;
  targetPort: number | null;
  upstreamProtocol: "http" | "https" | null;
  routingMigrationState: "target" | "legacy";
};
type Application = { id: string; name: string; projectId: string };
type ApplicationConfiguration = { ports: Array<{ internalPort: number; protocol: string; exposure: string }> };

const hostnamePattern =
  /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

function isValidHostname(value: string) {
  return hostnamePattern.test(value.trim().toLowerCase());
}

function apiUrl(path: string) {
  return `${process.env.NEXT_PUBLIC_API_URL ?? ""}${path}`;
}

export default function DomainsPage() {
  const { orgSlug, projectId } = useParams<{
    orgSlug: string;
    projectId: string;
  }>();
  const queryClient = useQueryClient();
  const queryKey = ["orgs", orgSlug, "projects", projectId, "domains"] as const;
  const [isCreating, setIsCreating] = useState(false);
  const [editing, setEditing] = useState<ProjectDomain | null>(null);
  const [hostname, setHostname] = useState("");
  const [environment, setEnvironment] = useState("production");
  const [applicationId, setApplicationId] = useState("");
  const [targetPort, setTargetPort] = useState("");
  const [upstreamProtocol, setUpstreamProtocol] = useState<"http" | "https">("http");
  const [formError, setFormError] = useState<string | null>(null);

  const domains = useQuery<ProjectDomain[]>({
    queryKey,
    queryFn: async () => {
      const response = await fetch(
        apiUrl(`/organizations/${orgSlug}/projects/${projectId}/domains`),
        { credentials: "include" },
      );
      if (!response.ok)
        throw new Error("Domains konnten nicht geladen werden.");
      return response.json();
    },
  });
  const applications = useQuery<Application[]>({ queryKey: ["org", orgSlug, "applications"], queryFn: async () => { const response = await fetch(apiUrl(`/organizations/${orgSlug}/applications`), { credentials: "include" }); if (!response.ok) throw new Error("Applications konnten nicht geladen werden."); return response.json(); } });
  const selectedApplication = applications.data?.find((application) => application.id === applicationId);
  const configuration = useQuery<ApplicationConfiguration>({ enabled: Boolean(selectedApplication), queryKey: ["application", applicationId, "configuration"], queryFn: async () => { const response = await fetch(apiUrl(`/organizations/${orgSlug}/projects/${projectId}/applications/${applicationId}/configuration`), { credentials: "include" }); if (!response.ok) throw new Error("Ports konnten nicht geladen werden."); return response.json(); } });

  const invalidate = () => queryClient.invalidateQueries({ queryKey });
  const createDomain = useMutation({
    mutationFn: async (payload: { hostname: string; environment: string; applicationId: string; targetPort: number; upstreamProtocol: "http" | "https" }) => {
      const response = await fetch(
        apiUrl(`/organizations/${orgSlug}/projects/${projectId}/domains`),
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!response.ok)
        throw new Error(
          (await response.json().catch(() => null))?.error ??
            "Domain konnte nicht hinzugefügt werden.",
        );
    },
    onSuccess: () => {
      setIsCreating(false);
      setHostname("");
      setEnvironment("production");
      setFormError(null);
      invalidate();
    },
    onError: (error: Error) => setFormError(error.message),
  });
  const updateDomain = useMutation({
    mutationFn: async ({ id, ...payload }: ProjectDomain) => {
      const response = await fetch(
        apiUrl(`/organizations/${orgSlug}/projects/${projectId}/domains/${id}`),
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hostname: payload.hostname, environment: payload.environment, applicationId: payload.applicationId, deploymentId: payload.deploymentId, targetPort: payload.targetPort, upstreamProtocol: payload.upstreamProtocol }),
        },
      );
      if (!response.ok)
        throw new Error(
          (await response.json().catch(() => null))?.error ??
            "Domain konnte nicht aktualisiert werden.",
        );
    },
    onSuccess: () => {
      setEditing(null);
      setFormError(null);
      setIsCreating(false);
      invalidate();
    },
    onError: (error: Error) => setFormError(error.message),
  });
  const deleteDomain = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(
        apiUrl(`/organizations/${orgSlug}/projects/${projectId}/domains/${id}`),
        { method: "DELETE", credentials: "include" },
      );
      if (!response.ok) throw new Error("Domain konnte nicht entfernt werden.");
    },
    onSuccess: invalidate,
  });
  const verifyDomain = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(
        apiUrl(
          `/organizations/${orgSlug}/projects/${projectId}/domains/${id}/verify`,
        ),
        { method: "POST", credentials: "include" },
      );
      if (!response.ok)
        throw new Error(
          (await response.json().catch(() => null))?.error ??
            "DNS-Prüfung konnte nicht gestartet werden.",
        );
    },
    onSuccess: invalidate,
  });

  function submit() {
    const normalizedHostname = hostname.trim().toLowerCase();
    if (!isValidHostname(normalizedHostname)) {
      setFormError(
        "Bitte gib einen gültigen Hostnamen ohne Protokoll oder Pfad ein.",
      );
      return;
    }
    if (!applicationId || !targetPort) { setFormError("Bitte wähle eine Application und einen öffentlichen TCP-Port."); return; }
    if (editing)
      updateDomain.mutate({
        ...editing,
        hostname: normalizedHostname,
        environment,
        applicationId,
        targetPort: Number(targetPort),
        upstreamProtocol,
      });
    else createDomain.mutate({ hostname: normalizedHostname, environment, applicationId, targetPort: Number(targetPort), upstreamProtocol });
  }

  function openCreate() {
    setEditing(null);
    setHostname("");
    setEnvironment("production");
    setApplicationId(""); setTargetPort(""); setUpstreamProtocol("http");
    setFormError(null);
    setIsCreating(true);
  }

  function openEdit(domain: ProjectDomain) {
    setEditing(domain);
    setHostname(domain.hostname);
    setEnvironment(domain.environment);
    setApplicationId(domain.applicationId ?? ""); setTargetPort(domain.targetPort ? String(domain.targetPort) : ""); setUpstreamProtocol(domain.upstreamProtocol ?? "http");
    setFormError(null);
    setIsCreating(true);
  }

  const saving = createDomain.isPending || updateDomain.isPending;

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title="Domains"
          description="Eigene Domains, Zielumgebungen und TLS-Status verwalten."
        />
        <Button size="sm" className="gap-1.5" onClick={openCreate}>
          <Plus className="h-3.5 w-3.5" />
          Domain hinzufügen
        </Button>
      </div>

      {isCreating && (
        <section className="rounded-xl border border-[#0984e3]/30 bg-[#0984e3]/5 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-100">
              {editing ? "Domain bearbeiten" : "Neue Domain"}
            </h2>
            <button
              type="button"
              aria-label="Formular schließen"
              onClick={() => setIsCreating(false)}
              className="text-zinc-500 hover:text-zinc-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              value={hostname}
              onChange={(event) => setHostname(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && submit()}
              inputMode="url"
              autoComplete="url"
              placeholder="app.example.com"
              className="h-9 rounded-lg border border-white/[0.1] bg-[#1e272e] px-3 font-mono text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-[#0984e3]"
            />
            <select
              value={environment}
              onChange={(event) => setEnvironment(event.target.value)}
              className="h-9 rounded-lg border border-white/[0.1] bg-[#1e272e] px-3 text-sm text-zinc-200 outline-none focus:border-[#0984e3]"
            >
              <option value="production">Production</option>
              <option value="staging">Staging</option>
              <option value="development">Development</option>
            </select>
            <select value={applicationId} onChange={(event) => { setApplicationId(event.target.value); setTargetPort(""); }} className="h-9 rounded-lg border border-white/[0.1] bg-[#1e272e] px-3 text-sm text-zinc-200"><option value="">Application auswählen</option>{applications.data?.filter((application) => application.projectId === projectId).map((application) => <option key={application.id} value={application.id}>{application.name}</option>)}</select>
            <select value={targetPort} onChange={(event) => setTargetPort(event.target.value)} disabled={!applicationId} className="h-9 rounded-lg border border-white/[0.1] bg-[#1e272e] px-3 text-sm text-zinc-200"><option value="">Öffentlichen TCP-Port auswählen</option>{configuration.data?.ports.filter((port) => port.protocol === "tcp" && port.exposure === "public").map((port) => <option key={port.internalPort} value={port.internalPort}>{port.internalPort}/tcp</option>)}</select>
            <select value={upstreamProtocol} onChange={(event) => setUpstreamProtocol(event.target.value as "http" | "https")} className="h-9 rounded-lg border border-white/[0.1] bg-[#1e272e] px-3 text-sm text-zinc-200"><option value="http">HTTP upstream</option><option value="https">HTTPS upstream</option></select>
            <Button size="sm" onClick={submit} disabled={saving}>
              {saving && (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              )}
              Speichern
            </Button>
          </div>
          {formError && (
            <p className="mt-3 text-xs text-red-400">{formError}</p>
          )}
        </section>
      )}

      <section className="overflow-hidden rounded-xl border border-white/[0.06] bg-[#1e272e]">
        {domains.isLoading ? (
          <div className="flex items-center gap-2 p-6 text-sm text-zinc-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Domains werden geladen …
          </div>
        ) : domains.isError ? (
          <div className="p-6 text-sm text-red-400">
            {domains.error.message}
          </div>
        ) : domains.data?.length ? (
          <div className="divide-y divide-white/[0.06]">
            {domains.data.map((domain) => (
              <div
                key={domain.id}
                className="group flex items-center gap-4 px-5 py-4"
              >
                <Globe className="h-4 w-4 shrink-0 text-[#00cec9]" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-sm font-medium text-zinc-100">
                    {domain.hostname}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                    <span>{domain.environment}</span>
                    {domain.routingMigrationState === "legacy" ? <span className="text-amber-300">Migration erforderlich: Application und Port auswählen</span> : null}
                    <span
                      className={
                        domain.status === "active"
                          ? "text-emerald-400"
                          : domain.status === "failed"
                            ? "text-red-400"
                            : "text-amber-400"
                      }
                    >
                      {domain.status === "active"
                        ? "Aktiv"
                        : domain.status === "failed"
                          ? "Fehler"
                          : "DNS-Prüfung ausstehend"}
                    </span>
                    {domain.sslExpiresAt && (
                      <span>
                        TLS bis{" "}
                        {new Date(domain.sslExpiresAt).toLocaleDateString(
                          "de-DE",
                        )}
                      </span>
                    )}
                  </div>
                </div>
                {domain.status === "active" && (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                )}
                {domain.status !== "active" && (
                  <button
                    type="button"
                    onClick={() => verifyDomain.mutate(domain.id)}
                    disabled={verifyDomain.isPending}
                    className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-amber-400 hover:bg-amber-400/10 disabled:opacity-50"
                  >
                    <RefreshCw
                      className={`h-3.5 w-3.5 ${verifyDomain.isPending ? "animate-spin" : ""}`}
                    />
                    DNS prüfen
                  </button>
                )}
                <button
                  type="button"
                  aria-label={`${domain.hostname} bearbeiten`}
                  onClick={() => openEdit(domain)}
                  className="rounded-lg p-2 text-zinc-500 opacity-0 transition hover:bg-white/[0.06] hover:text-zinc-100 group-hover:opacity-100"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  aria-label={`${domain.hostname} entfernen`}
                  onClick={() => deleteDomain.mutate(domain.id)}
                  disabled={deleteDomain.isPending}
                  className="rounded-lg p-2 text-zinc-500 opacity-0 transition hover:bg-red-400/10 hover:text-red-400 group-hover:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-10 text-center">
            <Globe className="mx-auto mb-3 h-7 w-7 text-zinc-600" />
            <p className="text-sm font-medium text-zinc-300">
              Noch keine Domain konfiguriert
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Füge eine Custom-Domain hinzu und richte anschließend den
              DNS-Eintrag ein.
            </p>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-4 text-xs text-zinc-400">
        <p className="font-medium text-amber-300">DNS-Konfiguration</p>
        <p className="mt-1">
          Lege einen CNAME-Eintrag für den Hostnamen auf{" "}
          <span className="font-mono text-zinc-200">proxy.devion.app</span> an.
          Nach einer Hostnamen-Änderung wird die Domain erneut geprüft.
        </p>
      </section>
    </div>
  );
}
