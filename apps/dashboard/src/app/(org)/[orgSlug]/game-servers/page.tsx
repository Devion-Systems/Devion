"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleAlert, Gamepad2, LoaderCircle, Play, Plus, Send, Square, Terminal, Trash2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { DesignEmptyState } from "@/components/layout/design-empty-state";
import { ResourceStatusBadge } from "@/components/resources/resource-status-badge";
import { Button } from "@/components/ui/button";

type Server = {
  id: string;
  name: string;
  version: string;
  memoryMib: number;
  status: string;
  runtimePort: number | null;
  projectId: string | null;
};
type Project = { id: string; name: string };
type Node = { id: string; status: string; schedulingEnabled: boolean };
type Team = { id: string; name: string };
type OrgMember = { userId: string; name: string; email: string };
type AccessGrant = {
  id: string;
  subjectType: "user" | "team";
  role: "viewer" | "operator" | "admin";
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  teamId: string | null;
  teamName: string | null;
};
type ConsoleData = { logs: string; updatedAt: string | null; status: string };
type CommandResult = { status: string; output: string; error: string | null };
const api = (path: string) => `${process.env.NEXT_PUBLIC_API_URL ?? ""}${path}`;
const minecraftVersions = [
  "LATEST",
  "26.1.2",
  "26.1",
  "1.21.8",
  "1.21.7",
  "1.21.6",
  "1.21.5",
  "1.21.4",
  "1.20.6",
  "1.20.4",
  "1.19.4",
  "1.18.2",
  "1.16.5",
];

async function responseMessage(response: Response, fallback: string) {
  try {
    const body = await response.json() as { error?: string };
    return body.error ?? fallback;
  } catch {
    return fallback;
  }
}

export default function GameServersPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const client = useQueryClient();
  const [name, setName] = useState("");
  const [version, setVersion] = useState("LATEST");
  const [projectId, setProjectId] = useState("");
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null);
  const [consoleCommand, setConsoleCommand] = useState("");
  const [lastCommandId, setLastCommandId] = useState<string | null>(null);
  const [grantTarget, setGrantTarget] = useState("");
  const [grantRole, setGrantRole] = useState<AccessGrant["role"]>("operator");
  const [managementTab, setManagementTab] = useState<"console" | "files">("console");
  const [fileEntries, setFileEntries] = useState<string[]>([]);
  const [filePath, setFilePath] = useState("");
  const [fileContent, setFileContent] = useState("");
  const [fileBusy, setFileBusy] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Server | null>(null);
  const servers = useQuery<Server[]>({
    queryKey: ["org", orgSlug, "game-servers"],
    queryFn: async () => {
      const response = await fetch(
        api(`/organizations/${orgSlug}/game-servers`),
        { credentials: "include" },
      );
      if (!response.ok)
        throw new Error("Game Server konnten nicht geladen werden");
      return response.json();
    },
  });
  const projects = useQuery<Project[]>({
    queryKey: ["org", orgSlug, "projects"],
    queryFn: async () => {
      const response = await fetch(api(`/organizations/${orgSlug}/projects`), {
        credentials: "include",
      });
      if (!response.ok)
        throw new Error("Projekte konnten nicht geladen werden");
      return response.json();
    },
  });
  const nodes = useQuery<Node[]>({
    queryKey: ["org", orgSlug, "nodes"],
    queryFn: async () => {
      const response = await fetch(api(`/organizations/${orgSlug}/nodes`), { credentials: "include" });
      if (!response.ok) throw new Error("Nodes konnten nicht geladen werden");
      return response.json();
    },
  });
  const teams = useQuery<Team[]>({
    queryKey: ["org", orgSlug, "teams"],
    queryFn: async () => {
      const response = await fetch(api(`/organizations/${orgSlug}/teams`), { credentials: "include" });
      if (!response.ok) throw new Error("Teams konnten nicht geladen werden");
      return response.json();
    },
  });
  const members = useQuery<OrgMember[]>({
    queryKey: ["org", orgSlug, "team-members"],
    queryFn: async () => {
      const response = await fetch(api(`/organizations/${orgSlug}/team-members`), { credentials: "include" });
      if (!response.ok) throw new Error("Mitglieder konnten nicht geladen werden");
      return response.json();
    },
  });
  const refresh = () =>
    void client.invalidateQueries({
      queryKey: ["org", orgSlug, "game-servers"],
    });
  const create = useMutation({
    mutationFn: async () => {
      const response = await fetch(
        api(`/organizations/${orgSlug}/game-servers`),
        {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            projectId,
            name,
            game: "minecraft-java",
            version,
            memoryMib: 2048,
          }),
        },
      );
      if (!response.ok) throw new Error(await responseMessage(response, "Server konnte nicht erstellt werden"));
    },
    onSuccess: () => {
      setName("");
      setNotice("Der Server wird bereitgestellt.");
      refresh();
    },
  });
  const action = useMutation({
    mutationFn: async ({
      server,
      method,
    }: {
      server: Server;
      method: "start" | "stop" | "delete";
    }) => {
      const response = await fetch(
        api(
          `/organizations/${orgSlug}/game-servers/${server.id}${method === "delete" ? "" : `/${method}`}`,
        ),
        {
          method: method === "delete" ? "DELETE" : "POST",
          credentials: "include",
        },
      );
      if (!response.ok) throw new Error(await responseMessage(response, "Aktion fehlgeschlagen"));
    },
    onSuccess: (_, input) => {
      setNotice(input.method === "start" ? "Der Server wird gestartet." : input.method === "stop" ? "Der Server wird gestoppt." : "Der Server wurde gelöscht.");
      if (input.method === "delete" && selectedServerId === input.server.id) setSelectedServerId(null);
      refresh();
    },
  });
  const consoleData = useQuery<ConsoleData>({
    queryKey: ["org", orgSlug, "game-servers", selectedServerId, "console"],
    enabled: Boolean(selectedServerId),
    refetchInterval: 2_500,
    queryFn: async () => {
      const response = await fetch(
        api(`/organizations/${orgSlug}/game-servers/${selectedServerId}/console?tail=800`),
        { credentials: "include" },
      );
      if (!response.ok) throw new Error("Server-Konsole konnte nicht geladen werden");
      return response.json();
    },
  });
  const commandResult = useQuery<CommandResult>({
    queryKey: ["org", orgSlug, "game-servers", selectedServerId, "console-command", lastCommandId],
    enabled: Boolean(selectedServerId && lastCommandId),
    refetchInterval: (query) =>
      query.state.data?.status === "pending" || query.state.data?.status === "delivered" ? 1_000 : false,
    queryFn: async () => {
      const response = await fetch(
        api(`/organizations/${orgSlug}/game-servers/${selectedServerId}/console/commands/${lastCommandId}`),
        { credentials: "include" },
      );
      if (!response.ok) throw new Error("Konsolenbefehl konnte nicht gelesen werden");
      return response.json();
    },
  });
  const command = useMutation({
    mutationFn: async () => {
      if (!selectedServerId) throw new Error("Kein Server ausgewaehlt");
      const response = await fetch(
        api(`/organizations/${orgSlug}/game-servers/${selectedServerId}/console`),
        {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ command: consoleCommand }),
        },
      );
      if (!response.ok) throw new Error("Konsolenbefehl konnte nicht gesendet werden");
      return response.json() as Promise<{ commandId: string }>;
    },
    onSuccess: (result) => {
      setLastCommandId(result.commandId);
      setConsoleCommand("");
      setNotice("Konsolenbefehl wurde an den Node-Agent gesendet.");
      void consoleData.refetch();
    },
  });
  const selectedServer = (servers.data ?? []).find((server) => server.id === selectedServerId);
  const runFileCommand = async (action: "list" | "read" | "write", payload: Record<string, string> = {}) => {
    if (!selectedServerId) return null;
    setFileBusy(true); setFileError(null);
    try {
      const submitted = await fetch(
        api(`/organizations/${orgSlug}/game-servers/${selectedServerId}/files/${action}`),
        { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) },
      );
      if (!submitted.ok) throw new Error("Dateioperation konnte nicht gestartet werden");
      const { commandId } = await submitted.json() as { commandId: string };
      for (let attempt = 0; attempt < 20; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 750));
        const response = await fetch(api(`/organizations/${orgSlug}/game-servers/${selectedServerId}/files/commands/${commandId}`), { credentials: "include" });
        if (!response.ok) throw new Error("Dateioperation konnte nicht gelesen werden");
        const result = await response.json() as { status: string; data: { entries?: string; content?: string } | null; error: string | null };
        if (result.status === "succeeded") return result.data;
        if (result.status === "failed") throw new Error(result.error ?? "Dateioperation fehlgeschlagen");
      }
      throw new Error("Agent antwortet nicht rechtzeitig");
    } catch (error) {
      setFileError(error instanceof Error ? error.message : "Dateioperation fehlgeschlagen");
      return null;
    } finally { setFileBusy(false); }
  };
  const loadFiles = async () => {
    const result = await runFileCommand("list");
    if (typeof result?.entries === "string") setFileEntries(result.entries.split("\n").filter(Boolean));
  };
  const openFile = async (path: string) => {
    setFilePath(path);
    const result = await runFileCommand("read", { path });
    if (typeof result?.content === "string") setFileContent(result.content);
  };
  const grants = useQuery<AccessGrant[]>({
    queryKey: ["org", orgSlug, "game-servers", selectedServerId, "access"],
    enabled: Boolean(selectedServerId),
    queryFn: async () => {
      const response = await fetch(
        api(`/organizations/${orgSlug}/game-servers/${selectedServerId}/access`),
        { credentials: "include" },
      );
      if (!response.ok) throw new Error("Server-Zugriffe konnten nicht geladen werden");
      return response.json();
    },
  });
  const saveGrant = useMutation({
    mutationFn: async () => {
      if (!selectedServerId || !grantTarget) throw new Error("Kein Zugriffsziel ausgewaehlt");
      const [subjectType, subjectId] = grantTarget.split(":", 2) as ["user" | "team", string];
      const response = await fetch(
        api(`/organizations/${orgSlug}/game-servers/${selectedServerId}/access`),
        {
          method: "PUT", credentials: "include", headers: { "content-type": "application/json" },
          body: JSON.stringify({ subjectType, subjectId, role: grantRole }),
        },
      );
      if (!response.ok) throw new Error("Zugriff konnte nicht gespeichert werden");
    },
    onSuccess: () => { setGrantTarget(""); void grants.refetch(); },
  });
  const removeGrant = useMutation({
    mutationFn: async (grantId: string) => {
      const response = await fetch(
        api(`/organizations/${orgSlug}/game-servers/${selectedServerId}/access/${grantId}`),
        { method: "DELETE", credentials: "include" },
      );
      if (!response.ok) throw new Error("Zugriff konnte nicht entfernt werden");
    },
    onSuccess: () => void grants.refetch(),
  });
  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Game Server"
        description="Minecraft-Java-Server mit Konsole, Dateien und rollenbasiertem Zugriff."
      />
      {nodes.isSuccess && !nodes.data.some((node) => node.status === "ready" && node.schedulingEnabled) ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
          <span>Die lokale Hardware wird gerade vorbereitet. Starte den Server erneut, sobald sie als bereit angezeigt wird.</span>
          <Button asChild size="sm" variant="outline" className="min-h-10"><Link href={`/${orgSlug}/hardware`}>Hardware öffnen</Link></Button>
        </div>
      ) : null}
      {notice ? (
        <div role="status" className="flex items-center justify-between gap-3 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} className="rounded px-2 py-1 text-xs font-medium hover:bg-emerald-400/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200">Schließen</button>
        </div>
      ) : null}
      <section className="rounded-2xl border border-white/[0.08] bg-[#172128] p-5">
        <div className="mb-4">
          <h2 className="font-medium text-zinc-100">Neuen Server erstellen</h2>
          <p className="mt-1 text-sm text-zinc-500">Projekt, Name und Minecraft-Version festlegen.</p>
        </div>
        <div className="flex flex-wrap gap-3">
        <select
          value={projectId}
          onChange={(event) => setProjectId(event.target.value)}
          className="h-9 min-w-48 rounded-xl border border-white/[0.1] bg-[#0b1217] px-3 text-zinc-100"
        >
          <option value="">Projekt wählen</option>
          {(projects.data ?? []).map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
        <label className="min-w-56 flex-1 text-sm text-zinc-300">
          <span className="mb-1 block">Servername</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Mein Minecraft-Server"
            aria-invalid={name.length > 80}
            className="h-10 w-full rounded-xl border border-white/[0.1] bg-[#0b1217] px-3 text-zinc-100 outline-none transition focus-visible:border-[#81ecec] focus-visible:ring-2 focus-visible:ring-[#81ecec]/30"
          />
          {name.length > 80 ? <span className="mt-1 flex items-center gap-1 text-xs text-red-300"><CircleAlert className="size-3" />Maximal 80 Zeichen</span> : null}
        </label>
        <input
          value={version}
          onChange={(event) => setVersion(event.target.value)}
          list="minecraft-versions"
          aria-label="Minecraft-Version"
          className="h-10 w-36 rounded-xl border border-white/[0.1] bg-[#0b1217] px-3 text-zinc-100 outline-none transition focus-visible:border-[#81ecec] focus-visible:ring-2 focus-visible:ring-[#81ecec]/30"
        />
        <datalist id="minecraft-versions">
          {minecraftVersions.map((minecraftVersion) => (
            <option key={minecraftVersion} value={minecraftVersion} />
          ))}
        </datalist>
        <Button
          className="h-10"
          disabled={!name.trim() || name.length > 80 || !projectId || create.isPending}
          onClick={() => create.mutate()}
        >
          {create.isPending ? <LoaderCircle className="mr-1 size-3.5 animate-spin" /> : <Plus className="mr-1 size-3.5" />}
          {create.isPending ? "Erstellt ..." : "Server erstellen"}
        </Button>
        </div>
        {create.error ? <p className="mt-3 text-sm text-red-300">{create.error.message}</p> : null}
      </section>
      {servers.isLoading ? (
        <p className="text-sm text-zinc-500">Server werden geladen …</p>
      ) : null}
      {servers.isError ? <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200"><span>{servers.error.message}</span><Button size="sm" variant="outline" className="min-h-10" onClick={() => void servers.refetch()}>Erneut versuchen</Button></div> : null}
      {action.error ? <p className="rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200">{action.error.message}</p> : null}
      <div className="grid gap-3 lg:grid-cols-2">
        {(servers.data ?? []).map((server) => (
          <section
            key={server.id}
            className={`rounded-2xl border bg-[#172128] p-5 transition-colors ${selectedServerId === server.id ? "border-[#81ecec]/60" : "border-white/[0.07] hover:border-white/[0.16]"}`}
          >
            <div className="flex justify-between gap-3">
              <div>
                <Gamepad2 className="size-5 text-[#81ecec]" />
                <h2 className="mt-3 font-medium text-zinc-100">
                  {server.name}
                </h2>
                <p className="mt-1 text-xs text-zinc-500">
                  Minecraft Java {server.version} · {server.memoryMib} MiB
                  {server.runtimePort ? ` · Port ${server.runtimePort}` : ""}
                </p>
              </div>
              <ResourceStatusBadge
                status={server.status === "running" ? "healthy" : server.status}
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                className="min-h-10"
                disabled={server.status === "running" || action.isPending}
                onClick={() => action.mutate({ server, method: "start" })}
              >
                <Play className="mr-1 size-3.5" />
                Starten
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="min-h-10"
                disabled={server.status !== "running" || action.isPending}
                onClick={() => action.mutate({ server, method: "stop" })}
              >
                <Square className="mr-1 size-3.5" />
                Stoppen
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="min-h-10"
                onClick={() => {
                  setSelectedServerId(server.id);
                  setLastCommandId(null);
                  setManagementTab("console");
                }}
              >
                <Terminal className="mr-1 size-3.5" />
                Management
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="min-h-10"
                onClick={() => {
                  setPendingDelete(server);
                }}
              >
                <Trash2 className="mr-1 size-3.5" />
                Löschen
              </Button>
            </div>
          </section>
        ))}
      </div>
      {!servers.isLoading && !servers.isError && (servers.data?.length ?? 0) === 0 ? <DesignEmptyState icon={Gamepad2} title="Noch keine Minecraft-Server" description="Erstelle den ersten Server und ordne ihn einem Projekt zu." detail="Der Server wird anschließend automatisch auf einem passenden Node bereitgestellt." /> : null}
      {selectedServer ? (
        <section className="rounded-2xl border border-[#81ecec]/30 bg-[#172128] p-5 shadow-2xl shadow-black/20">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-medium text-zinc-100">Management: {selectedServer.name}</h2>
              <p className="mt-1 text-xs text-zinc-500">
                Live-Logs werden alle 2,5 Sekunden aktualisiert. Befehle werden sicher ueber RCON ausgefuehrt.
              </p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setSelectedServerId(null)}>
              Schliessen
            </Button>
          </div>
          <div className="mt-4 flex gap-2 border-b border-white/[0.08] pb-3" role="tablist" aria-label="Server Management">
            <Button size="sm" role="tab" aria-selected={managementTab === "console"} variant={managementTab === "console" ? "default" : "ghost"} onClick={() => setManagementTab("console")}>Konsole</Button>
            <Button size="sm" role="tab" aria-selected={managementTab === "files"} variant={managementTab === "files" ? "default" : "ghost"} onClick={() => { setManagementTab("files"); void loadFiles(); }}>Dateien</Button>
          </div>
          {managementTab === "console" ? <>
          <pre className="mt-4 max-h-[32rem] overflow-auto rounded-xl bg-[#080d10] p-4 font-mono text-xs leading-5 text-emerald-200">
            {consoleData.data?.logs || "Warte auf Server-Logs ..."}
          </pre>
          {commandResult.data?.output || commandResult.data?.error ? (
            <pre className="mt-3 overflow-auto rounded-xl border border-white/[0.08] bg-[#0b1217] p-3 font-mono text-xs text-zinc-200">
              {commandResult.data.error ?? commandResult.data.output}
            </pre>
          ) : null}
          <form
            className="mt-4 flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (consoleCommand.trim()) command.mutate();
            }}
          >
            <input
              value={consoleCommand}
              onChange={(event) => setConsoleCommand(event.target.value)}
              placeholder="say Hallo Welt"
              className="h-10 min-w-0 flex-1 rounded-xl border border-white/[0.1] bg-[#0b1217] px-3 font-mono text-sm text-zinc-100"
            />
            <Button type="submit" disabled={!consoleCommand.trim() || command.isPending}>
              <Send className="mr-1 size-3.5" />
              Senden
            </Button>
          </form>
          {command.error ? <p className="mt-2 text-sm text-red-300">{command.error.message}</p> : null}
          </> : <div className="mt-4 grid gap-4 lg:grid-cols-[20rem_1fr]">
            <aside className="max-h-[32rem] overflow-auto rounded-xl bg-[#080d10] p-3 font-mono text-xs text-zinc-300">
              <div className="mb-3 flex items-center justify-between border-b border-white/[0.08] pb-2 font-sans"><span className="font-medium text-zinc-100">/data</span><Button size="sm" variant="ghost" disabled={fileBusy} onClick={() => void loadFiles()}>Aktualisieren</Button></div>
              {fileEntries.map((entry) => {
                const [kind, path] = entry.split("\t");
                return <button type="button" key={entry} disabled={kind !== "f" || fileBusy} onClick={() => path && void openFile(path)} style={{ paddingLeft: `${Math.min((path?.split("/").length ?? 1) - 1, 5) * 12 + 8}px` }} className={`block w-full truncate rounded py-1.5 text-left hover:bg-white/[0.08] disabled:opacity-60 ${filePath === path ? "bg-[#81ecec]/15 text-[#b8ffff]" : ""}`}>{kind === "d" ? "▸ " : "• "}{path?.split("/").at(-1)}</button>;
              })}
              {!fileBusy && fileEntries.length === 0 ? <p className="px-2 py-4 font-sans text-sm text-zinc-500">Keine Dateien geladen.</p> : null}
            </aside>
            <div>
              <div className="mb-2 font-mono text-xs text-zinc-500">{filePath ? `/data/${filePath}` : "Datei auswaehlen"}</div>
              <textarea value={fileContent} onChange={(event) => setFileContent(event.target.value)} disabled={!filePath || fileBusy} className="h-[26rem] w-full resize-y rounded-xl border border-white/[0.1] bg-[#080d10] p-3 font-mono text-xs text-zinc-100" placeholder="Datei aus dem Baum auswaehlen" />
              <div className="mt-2 flex items-center gap-3"><Button size="sm" disabled={!filePath || fileBusy} onClick={async () => { const result = await runFileCommand("write", { path: filePath, content: fileContent }); if (result !== null) await loadFiles(); }}>Speichern</Button>{fileError ? <span className="text-xs text-red-300">{fileError}</span> : null}</div>
            </div>
          </div>}
          <div className="mt-6 border-t border-white/[0.08] pt-5">
            <h3 className="font-medium text-zinc-100">Server-Rollen</h3>
            <p className="mt-1 text-xs text-zinc-500">Viewer sehen Logs, Operatoren steuern Server und Konsole, Admins verwalten diese Zugriffe.</p>
            {grants.isError ? <p className="mt-3 text-sm text-zinc-500">Die Rollenliste ist nur für Server-Admins sichtbar.</p> : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <select value={grantTarget} onChange={(event) => setGrantTarget(event.target.value)} className="h-9 min-w-52 rounded-xl border border-white/[0.1] bg-[#0b1217] px-3 text-sm text-zinc-100">
                <option value="">Person oder Team waehlen</option>
                {(members.data ?? []).map((member) => <option key={`user:${member.userId}`} value={`user:${member.userId}`}>Person: {member.name || member.email}</option>)}
                {(teams.data ?? []).map((team) => <option key={`team:${team.id}`} value={`team:${team.id}`}>Team: {team.name}</option>)}
              </select>
              <select value={grantRole} onChange={(event) => setGrantRole(event.target.value as AccessGrant["role"])} className="h-9 rounded-xl border border-white/[0.1] bg-[#0b1217] px-3 text-sm text-zinc-100">
                <option value="viewer">Viewer</option><option value="operator">Operator</option><option value="admin">Admin</option>
              </select>
              <Button size="sm" disabled={!grants.isSuccess || !grantTarget || saveGrant.isPending} onClick={() => saveGrant.mutate()}>Zugriff geben</Button>
            </div>
            {saveGrant.error || removeGrant.error ? <p className="mt-2 text-sm text-red-300">{saveGrant.error?.message ?? removeGrant.error?.message}</p> : null}
            <div className="mt-3 space-y-2">
              {(grants.data ?? []).map((grant) => (
                <div key={grant.id} className="flex items-center justify-between rounded-xl bg-[#0b1217] px-3 py-2 text-sm text-zinc-200">
                  <span>{grant.subjectType === "team" ? `Team: ${grant.teamName}` : grant.userName || grant.userEmail} <span className="text-zinc-500">- {grant.role}</span></span>
                  <Button size="sm" variant="ghost" onClick={() => removeGrant.mutate(grant.id)}>Entfernen</Button>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}
      {pendingDelete ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" role="presentation">
          <section role="alertdialog" aria-modal="true" aria-labelledby="delete-server-title" aria-describedby="delete-server-description" className="w-full max-w-md rounded-2xl border border-red-400/30 bg-[#172128] p-6 shadow-2xl">
            <div className="flex items-start gap-3">
              <CircleAlert className="mt-0.5 size-5 shrink-0 text-red-300" aria-hidden="true" />
              <div className="min-w-0">
                <h2 id="delete-server-title" className="font-semibold text-zinc-100">Server löschen?</h2>
                <p id="delete-server-description" className="mt-2 text-sm leading-6 text-zinc-400">{pendingDelete.name} und die zugehörige Spielwelt werden dauerhaft entfernt. Diese Aktion kann nicht rückgängig gemacht werden.</p>
              </div>
            </div>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" className="min-h-11" disabled={action.isPending} onClick={() => setPendingDelete(null)}>Abbrechen</Button>
              <Button variant="destructive" className="min-h-11" disabled={action.isPending} onClick={() => action.mutate({ server: pendingDelete, method: "delete" }, { onSuccess: () => setPendingDelete(null) })}>{action.isPending ? "Löscht ..." : "Endgültig löschen"}</Button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
