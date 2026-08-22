"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, Check, ChevronRight, CircleAlert, Copy, Cpu, File, FileText, Folder, FolderOpen, FolderTree, Gamepad2, HardDrive, LoaderCircle, MemoryStick, Network, Play, Plus, RefreshCw, Send, ShieldCheck, Square, Terminal, Trash2, Wifi, X } from "lucide-react";
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
type FileEntry = { kind: "d" | "f"; path: string; size: number };
const api = (path: string) => `${process.env.NEXT_PUBLIC_API_URL ?? ""}${path}`;
type MinecraftVersion = { id: string; type: string; releaseTime: string };
const fallbackMinecraftVersions: MinecraftVersion[] = [
  { id: "LATEST", type: "recommended", releaseTime: "" },
  { id: "1.21.8", type: "release", releaseTime: "" },
  { id: "1.21.7", type: "release", releaseTime: "" },
  { id: "1.20.6", type: "release", releaseTime: "" },
  { id: "1.20.4", type: "release", releaseTime: "" },
  { id: "1.19.4", type: "release", releaseTime: "" },
  { id: "1.18.2", type: "release", releaseTime: "" },
  { id: "1.16.5", type: "release", releaseTime: "" },
];
const minecraftManifestUrl = "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";

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
  const [managementTab, setManagementTab] = useState<"console" | "files" | "access">("console");
  const [fileEntries, setFileEntries] = useState<string[]>([]);
  const [fileBrowserPath, setFileBrowserPath] = useState("");
  const [filePath, setFilePath] = useState("");
  const [fileContent, setFileContent] = useState("");
  const [fileBusy, setFileBusy] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Server | null>(null);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const servers = useQuery<Server[]>({
    queryKey: ["org", orgSlug, "game-servers"],
    // Agent work is asynchronous. Keep the card state in sync while a server
    // is provisioning, starting, stopping, or recovering from a failure.
    refetchInterval: (query) =>
      query.state.data?.some((server) =>
        ["provisioning", "starting", "stopping", "failed"].includes(server.status),
      )
        ? 3_000
        : false,
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
  const versionCatalog = useQuery<MinecraftVersion[]>({
    queryKey: ["minecraft", "version-catalog"],
    staleTime: 24 * 60 * 60 * 1_000,
    queryFn: async () => {
      const response = await fetch(minecraftManifestUrl);
      if (!response.ok) throw new Error("Minecraft-Versionskatalog konnte nicht geladen werden");
      const manifest = await response.json() as { versions?: MinecraftVersion[] };
      return (manifest.versions ?? []).filter((item) => item.id && item.type);
    },
  });
  const minecraftVersions = versionCatalog.data ?? fallbackMinecraftVersions;
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
  const openManagement = (
    serverId: string,
    tab: "console" | "files" | "access" = "console",
  ) => {
    setSelectedServerId(serverId);
    setLastCommandId(null);
    setManagementTab(tab);
    setFileEntries([]);
    setFileBrowserPath("");
    setFilePath("");
    setFileContent("");
    setFileError(null);
  };
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
  const connectionAddress = selectedServer?.status === "running" && selectedServer.runtimePort
    ? `${typeof window === "undefined" ? "server" : window.location.hostname}:${selectedServer.runtimePort}`
    : null;
  const copyConnectionAddress = async () => {
    if (!connectionAddress) return;
    await navigator.clipboard.writeText(connectionAddress);
    setCopiedAddress(true);
    window.setTimeout(() => setCopiedAddress(false), 2_000);
  };
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
    setFileContent("");
    const result = await runFileCommand("read", { path });
    if (typeof result?.content === "string") setFileContent(result.content);
  };
  const fileBrowserEntries = fileEntries.flatMap((line): FileEntry[] => {
    const [kind, path, size] = line.split("\t");
    return (kind === "d" || kind === "f") && path ? [{ kind, path, size: Number(size) || 0 }] : [];
  }).filter((entry) => {
    const prefix = fileBrowserPath ? `${fileBrowserPath}/` : "";
    if (!entry.path.startsWith(prefix)) return false;
    return !entry.path.slice(prefix.length).includes("/");
  });
  const browserBreadcrumbs = fileBrowserPath ? fileBrowserPath.split("/") : [];
  const fileManager = (
    <div className="mt-4 grid gap-4 xl:grid-cols-[18rem_minmax(0,1fr)]">
      <aside className="min-h-[28rem] overflow-hidden rounded-xl border border-white/[0.08] bg-[#080d10]">
        <div className="border-b border-white/[0.08] px-3 py-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-medium text-zinc-100">Dateien</h3>
              <p className="mt-0.5 text-xs text-zinc-500">Persistenter Serverordner</p>
            </div>
            <Button size="icon-xs" variant="ghost" aria-label="Dateiliste aktualisieren" disabled={fileBusy} onClick={() => void loadFiles()}>
              <RefreshCw className={`size-3.5 ${fileBusy ? "animate-spin" : ""}`} />
            </Button>
          </div>
          <nav aria-label="Aktueller Ordner" className="mt-3 flex min-w-0 items-center overflow-x-auto text-xs text-zinc-400">
            <button type="button" onClick={() => setFileBrowserPath("")} className="shrink-0 rounded px-1 py-1 hover:bg-white/[0.08] hover:text-zinc-100">/data</button>
            {browserBreadcrumbs.map((part, index) => {
              const target = browserBreadcrumbs.slice(0, index + 1).join("/");
              return <span key={target} className="flex shrink-0 items-center"><ChevronRight className="size-3 text-zinc-600" /><button type="button" onClick={() => setFileBrowserPath(target)} className="rounded px-1 py-1 hover:bg-white/[0.08] hover:text-zinc-100">{part}</button></span>;
            })}
          </nav>
        </div>
        <div className="max-h-[27rem] overflow-auto p-2">
          {fileBrowserPath ? <button type="button" disabled={fileBusy} onClick={() => setFileBrowserPath(browserBreadcrumbs.slice(0, -1).join("/"))} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs text-zinc-400 hover:bg-white/[0.08] hover:text-zinc-100"><FolderOpen className="size-4 text-[#81ecec]" />..</button> : null}
          {fileBrowserEntries.map((entry) => {
            const label = entry.path.split("/").at(-1) ?? entry.path;
            const selected = entry.kind === "f" && filePath === entry.path;
            return <button type="button" key={entry.path} disabled={fileBusy} onClick={() => entry.kind === "d" ? setFileBrowserPath(entry.path) : void openFile(entry.path)} className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-xs transition-colors hover:bg-white/[0.08] disabled:opacity-60 ${selected ? "bg-[#81ecec]/15 text-[#b8ffff]" : "text-zinc-300"}`}>
              {entry.kind === "d" ? <Folder className="size-4 shrink-0 text-[#81ecec]" /> : <File className="size-4 shrink-0 text-zinc-500" />}<span className="min-w-0 flex-1 truncate">{label}</span>{entry.kind === "d" ? <ChevronRight className="size-3 shrink-0 text-zinc-600" /> : <span className="shrink-0 text-[10px] text-zinc-600">{entry.size < 1024 ? `${entry.size} B` : `${Math.ceil(entry.size / 1024)} KB`}</span>}
            </button>;
          })}
          {!fileBusy && fileBrowserEntries.length === 0 ? <p className="px-2 py-8 text-center text-sm text-zinc-500">Dieser Ordner ist leer.</p> : null}
        </div>
      </aside>
      <div className="min-w-0 rounded-xl border border-white/[0.08] bg-[#0b1217] p-3 sm:p-4">
        <div className="flex flex-wrap items-start justify-between gap-2 border-b border-white/[0.08] pb-3">
          <div className="min-w-0"><h3 className="text-sm font-medium text-zinc-100">Editor</h3><p className="mt-1 truncate font-mono text-xs text-zinc-500">{filePath ? `/data/${filePath}` : "Wähle links eine Datei aus."}</p></div>
          {filePath ? <span className="rounded bg-white/[0.06] px-2 py-1 font-mono text-[11px] text-zinc-400">Textdatei</span> : null}
        </div>
        <textarea value={fileContent} onChange={(event) => setFileContent(event.target.value)} disabled={!filePath || fileBusy} aria-label="Dateiinhalt" className="mt-3 h-[24rem] w-full resize-y rounded-lg border border-white/[0.1] bg-[#080d10] p-3 font-mono text-xs leading-5 text-zinc-100 outline-none focus-visible:border-[#81ecec] focus-visible:ring-2 focus-visible:ring-[#81ecec]/30 disabled:cursor-not-allowed disabled:opacity-60" placeholder="Wähle links eine Datei aus, um sie zu bearbeiten." />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-zinc-500">Speichern schreibt die Änderung direkt in die persistente Spielwelt.</p><Button size="sm" disabled={!filePath || fileBusy} onClick={async () => { const result = await runFileCommand("write", { path: filePath, content: fileContent }); if (result !== null) { setNotice("Datei wurde gespeichert."); await loadFiles(); } }}>{fileBusy ? <LoaderCircle className="size-3.5 animate-spin" /> : null}Speichern</Button></div>
        {fileError ? <p role="alert" className="mt-3 rounded-lg border border-red-400/20 bg-red-400/10 px-3 py-2 text-xs text-red-200">{fileError}</p> : null}
      </div>
    </div>
  );
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
        <label className="text-sm text-zinc-300"><span className="mb-1 block">Minecraft-Version</span><input
          value={version}
          onChange={(event) => setVersion(event.target.value)}
          list="minecraft-versions"
          aria-label="Minecraft-Version"
          className="h-10 w-44 rounded-xl border border-white/[0.1] bg-[#0b1217] px-3 text-zinc-100 outline-none transition focus-visible:border-[#81ecec] focus-visible:ring-2 focus-visible:ring-[#81ecec]/30"
        /></label>
        <datalist id="minecraft-versions">
          {minecraftVersions.map((minecraftVersion) => (
            <option key={minecraftVersion.id} value={minecraftVersion.id} label={minecraftVersion.type} />
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
                  openManagement(server.id);
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
        <section className="overflow-hidden rounded-2xl border border-[#81ecec]/30 bg-[#172128] shadow-2xl shadow-black/20">
          <header className="border-b border-white/[0.08] bg-[#121c22] px-5 py-5 sm:px-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-xl font-semibold text-zinc-50">{selectedServer.name}</h2>
                  <ResourceStatusBadge status={selectedServer.status === "running" ? "healthy" : selectedServer.status} />
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-zinc-400">
                  <span className="rounded-md bg-white/[0.06] px-2 py-1">Minecraft Java {selectedServer.version}</span>
                  <span className="rounded-md bg-white/[0.06] px-2 py-1">{selectedServer.runtimePort ? `Port ${selectedServer.runtimePort}` : "Port wird zugewiesen"}</span>
                  <span className="rounded-md bg-white/[0.06] px-2 py-1">Lokale Devion-Hardware</span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" className="min-h-10" disabled={selectedServer.status === "running" || action.isPending} onClick={() => action.mutate({ server: selectedServer, method: "start" })}><Play className="size-3.5" />Starten</Button>
                <Button size="sm" variant="outline" className="min-h-10" disabled={selectedServer.status !== "running" || action.isPending} onClick={() => action.mutate({ server: selectedServer, method: "stop" })}><Square className="size-3.5" />Stoppen</Button>
                <Button size="icon" variant="ghost" aria-label="Serverstatus aktualisieren" className="min-h-10 min-w-10" onClick={() => void servers.refetch()}><RefreshCw className="size-4" /></Button>
                <Button size="icon" variant="ghost" aria-label="Management schliessen" className="min-h-10 min-w-10" onClick={() => setSelectedServerId(null)}><X className="size-4" /></Button>
              </div>
            </div>
          </header>
          <div className="grid xl:grid-cols-[minmax(0,1fr)_19rem]">
            <main className="min-w-0 p-5 sm:p-6">
          <div className="flex flex-wrap gap-1 border-b border-white/[0.08] pb-3" role="tablist" aria-label="Server Management">
            <Button size="sm" role="tab" aria-selected={managementTab === "console"} variant={managementTab === "console" ? "default" : "ghost"} onClick={() => setManagementTab("console")}><Terminal className="size-3.5" />Konsole</Button>
            <Button size="sm" role="tab" aria-selected={managementTab === "files"} variant={managementTab === "files" ? "default" : "ghost"} onClick={() => { setManagementTab("files"); void loadFiles(); }}><FolderTree className="size-3.5" />Dateien</Button>
            <Button size="sm" role="tab" aria-selected={managementTab === "access"} variant={managementTab === "access" ? "default" : "ghost"} onClick={() => setManagementTab("access")}><ShieldCheck className="size-3.5" />Zugriff</Button>
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
          </> : managementTab === "files" ? fileManager : null}
          {managementTab === "access" ? <div className="mt-6 border-t border-white/[0.08] pt-5">
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
          </div> : null}
            </main>
            <aside className="border-t border-white/[0.08] bg-[#10191f] p-5 xl:border-t-0 xl:border-l">
              <h3 className="text-sm font-semibold text-zinc-100">Serverstatus</h3>
              <div className="mt-4 space-y-4 text-sm">
                <div><span className="inline-flex items-center gap-2 text-zinc-500"><Wifi className="size-3.5" />Minecraft-Joinsadresse</span>{connectionAddress ? <div className="mt-2 flex items-center gap-1 rounded-lg border border-white/[0.08] bg-[#080d10] p-1"><code className="min-w-0 flex-1 truncate px-2 font-mono text-xs text-emerald-200">{connectionAddress}</code><Button size="icon-xs" variant="ghost" aria-label="Joinsadresse kopieren" onClick={() => void copyConnectionAddress()}>{copiedAddress ? <Check className="size-3.5 text-emerald-300" /> : <Copy className="size-3.5" />}</Button></div> : <p className="mt-2 text-xs text-zinc-500">Wird verfügbar, sobald der Server läuft.</p>}</div>
                <div className="flex items-center justify-between gap-3"><span className="inline-flex items-center gap-2 text-zinc-500"><Activity className="size-3.5" />Zustand</span><ResourceStatusBadge status={selectedServer.status === "running" ? "healthy" : selectedServer.status} /></div>
                <div className="flex items-center justify-between gap-3"><span className="inline-flex items-center gap-2 text-zinc-500"><Network className="size-3.5" />Runtime</span><span className="text-xs text-zinc-200">Docker lokal</span></div>
              </div>
              <div className="mt-6 border-t border-white/[0.08] pt-5">
                <h3 className="text-sm font-semibold text-zinc-100">Ressourcen</h3>
                <div className="mt-4 space-y-4">
                  <div><div className="flex items-center justify-between text-xs text-zinc-400"><span className="inline-flex items-center gap-2"><Cpu className="size-3.5" />CPU</span><span>Agent-gesteuert</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.08]"><div className="h-full w-1/4 rounded-full bg-[#81ecec]" /></div></div>
                  <div><div className="flex items-center justify-between text-xs text-zinc-400"><span className="inline-flex items-center gap-2"><MemoryStick className="size-3.5" />Arbeitsspeicher</span><span>{selectedServer.memoryMib} MiB</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.08]"><div className="h-full w-1/2 rounded-full bg-[#00cec9]" /></div></div>
                  <div><div className="flex items-center justify-between text-xs text-zinc-400"><span className="inline-flex items-center gap-2"><HardDrive className="size-3.5" />Spielwelt</span><span>/data</span></div><p className="mt-1 text-[11px] text-zinc-600">Persistent gespeichert</p></div>
                </div>
              </div>
              <div className="mt-6 border-t border-white/[0.08] pt-5">
                <h3 className="text-sm font-semibold text-zinc-100">Schnellaktionen</h3>
                <div className="mt-3 grid gap-2"><Button size="sm" variant="outline" className="justify-start" onClick={() => { setManagementTab("files"); void loadFiles(); }}><FileText className="size-3.5" />Dateien öffnen</Button><Button size="sm" variant="destructive" className="justify-start" onClick={() => setPendingDelete(selectedServer)}><Trash2 className="size-3.5" />Server löschen</Button></div>
              </div>
            </aside>
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
