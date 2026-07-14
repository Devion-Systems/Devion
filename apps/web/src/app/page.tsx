import {
  ArrowRight,
  Boxes,
  Building2,
  Check,
  ChevronRight,
  CircleDot,
  FolderKanban,
  Gauge,
  GitBranch,
  LockKeyhole,
  Menu,
  Network,
  ScrollText,
  Server,
  ShieldCheck,
  TerminalSquare,
  Users,
  Workflow,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

const repositoryUrl = "https://github.com/Devion-Systems/Devion";

const navItems = [
  ["Produkt", "#product"],
  ["Bereiche", "#domains"],
  ["Architektur", "#architecture"],
  ["Zugriff", "#permissions"],
];

const domains = [
  {
    number: "01",
    icon: Building2,
    title: "Organizations",
    text: "Mandanten, Mitglieder und globale Einstellungen voneinander getrennt verwalten.",
    scope: "Multi-tenant",
  },
  {
    number: "02",
    icon: Users,
    title: "Teams",
    text: "Menschen, Einladungen und Zuständigkeiten um gemeinsame Arbeit organisieren.",
    scope: "Collaboration",
  },
  {
    number: "03",
    icon: FolderKanban,
    title: "Projects",
    text: "Anwendungen, Umgebungen und Konfigurationen an einem nachvollziehbaren Ort.",
    scope: "Workspaces",
  },
  {
    number: "04",
    icon: Server,
    title: "Hardware",
    text: "Server und Nodes verbinden, Zustände prüfen und Workloads gezielt zuweisen.",
    scope: "Your nodes",
  },
  {
    number: "05",
    icon: Gauge,
    title: "Resources",
    text: "CPU, RAM, Speicher und Bandbreite mit Limits, Quotas und Freigaben verteilen.",
    scope: "Fair use",
  },
  {
    number: "06",
    icon: Workflow,
    title: "Deployments",
    text: "Versionen ausrollen, Umgebungen vergleichen und bei Bedarf sauber zurückrollen.",
    scope: "Lifecycle",
  },
  {
    number: "07",
    icon: ScrollText,
    title: "Logs & Metrics",
    text: "Builds, Anwendungen und Container beobachten, ohne zwischen Tools zu springen.",
    scope: "Observability",
  },
  {
    number: "08",
    icon: ShieldCheck,
    title: "Permissions",
    text: "Festlegen, wer sehen, bearbeiten, deployen oder Infrastruktur verwalten darf.",
    scope: "RBAC",
  },
];

const nodes = [
  { name: "edge-01", meta: "12 workloads", cpu: 38, status: "online" },
  {
    name: "compute-02",
    meta: "8 workloads",
    cpu: 67,
    status: "online",
    selected: true,
  },
  { name: "storage-01", meta: "4 workloads", cpu: 21, status: "online" },
  { name: "worker-03", meta: "0 workloads", cpu: 4, status: "idle" },
];

const workloads = [
  {
    name: "api-production",
    team: "Platform",
    cpu: "0.8",
    memory: "512 MB",
    state: "healthy",
  },
  {
    name: "web-production",
    team: "Product",
    cpu: "1.2",
    memory: "1.4 GB",
    state: "healthy",
  },
  {
    name: "postgres-main",
    team: "Platform",
    cpu: "2.0",
    memory: "4.0 GB",
    state: "healthy",
  },
];

const meterSegments = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

function Logo() {
  return (
    <span className="inline-flex items-center gap-3">
      <span className="grid size-8 shrink-0 place-items-center bg-[#0984E3] text-white">
        <Boxes className="size-4" strokeWidth={2.2} />
      </span>
      <span className="font-mono text-sm font-semibold tracking-[-0.03em] text-white">
        DEVION
      </span>
    </span>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0E151A]/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center px-5 sm:px-8 lg:px-12">
        <Link href="/" aria-label="Devion Startseite" className="mr-auto">
          <Logo />
        </Link>

        <nav
          className="hidden h-full items-center border-l border-white/10 lg:flex"
          aria-label="Hauptnavigation"
        >
          {navItems.map(([label, href], index) => (
            <Link
              key={href}
              href={href}
              className="group flex h-full items-center gap-3 border-r border-white/10 px-6 font-mono text-[10px] uppercase tracking-[0.13em] text-white/45 transition hover:bg-white/[0.03] hover:text-white"
            >
              <span className="text-[#00CEC9]/60">0{index + 1}</span>
              {label}
            </Link>
          ))}
        </nav>

        <Link
          href={repositoryUrl}
          target="_blank"
          rel="noreferrer"
          className="ml-4 hidden h-10 items-center gap-2 border border-white/15 px-4 font-mono text-[10px] uppercase tracking-[0.12em] text-white/70 transition hover:border-[#00CEC9]/50 hover:text-white sm:inline-flex"
        >
          <GitBranch className="size-3.5" /> Repository
        </Link>

        <details className="group relative ml-3 lg:hidden">
          <summary className="grid size-10 cursor-pointer list-none place-items-center border border-white/15 text-white/70 marker:content-none">
            <Menu className="size-5" />
            <span className="sr-only">Navigation öffnen</span>
          </summary>
          <nav className="absolute right-0 top-12 flex w-56 flex-col border border-white/10 bg-[#11191F] p-2 shadow-2xl">
            {navItems.map(([label, href], index) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3 border-b border-white/[0.06] px-3 py-3 font-mono text-[10px] uppercase tracking-[0.12em] text-white/55 last:border-0 hover:bg-white/[0.03] hover:text-white"
              >
                <span className="text-[#00CEC9]">0{index + 1}</span> {label}
              </Link>
            ))}
          </nav>
        </details>
      </div>
    </header>
  );
}

function ResourceMeter({
  label,
  value,
  detail,
}: {
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <div>
      <div className="mb-2 flex items-end justify-between gap-3">
        <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-white/35">
          {label}
        </span>
        <span className="font-mono text-[9px] text-white/55">{detail}</span>
      </div>
      <div className="grid h-1.5 grid-cols-10 gap-1">
        {meterSegments.map((segment) => (
          <span
            key={`${label}-${segment}`}
            className={
              segment <= Math.ceil(value / 10) * 10
                ? "bg-[#0984E3]"
                : "bg-white/[0.07]"
            }
          />
        ))}
      </div>
    </div>
  );
}

function OperationsPanel() {
  return (
    <div
      id="product"
      className="w-full min-w-0 max-w-full border border-white/10 bg-[#0B1115] shadow-[0_28px_80px_rgba(0,0,0,.38)]"
    >
      <div className="flex h-11 items-center justify-between border-b border-white/10 px-4 font-mono text-[9px] uppercase tracking-[0.1em] text-white/30">
        <span className="flex items-center gap-2">
          <TerminalSquare className="size-3.5 text-[#00CEC9]" /> acme-systems /
          infrastructure
        </span>
        <span className="flex items-center gap-2 text-[#00CEC9]">
          <span className="devion-status-dot size-1.5 bg-[#00CEC9]" /> control
          plane online
        </span>
      </div>

      <div className="grid min-h-[486px] sm:grid-cols-[176px_1fr]">
        <aside className="hidden border-r border-white/10 bg-[#0E151A] sm:block">
          <div className="border-b border-white/10 p-4">
            <div className="font-mono text-[8px] uppercase tracking-[0.16em] text-white/25">
              Cluster
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-white/70">
              Private Rack <ChevronRight className="size-3 text-white/20" />
            </div>
          </div>
          <div className="p-2">
            <div className="px-2 py-2 font-mono text-[8px] uppercase tracking-[0.16em] text-white/20">
              Nodes / 04
            </div>
            {nodes.map((node) => (
              <div
                key={node.name}
                className={`border-l-2 px-3 py-3 ${node.selected ? "border-[#00CEC9] bg-white/[0.04]" : "border-transparent"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`text-[10px] ${node.selected ? "text-white" : "text-white/45"}`}
                  >
                    {node.name}
                  </span>
                  <span
                    className={`size-1.5 ${node.status === "online" ? "bg-[#00CEC9]" : "bg-white/20"}`}
                  />
                </div>
                <div className="mt-1 flex justify-between font-mono text-[7px] text-white/20">
                  <span>{node.meta}</span>
                  <span>{node.cpu}%</span>
                </div>
              </div>
            ))}
          </div>
          <div className="mx-4 mt-4 border-t border-white/10 pt-4">
            <div className="mb-2 flex justify-between font-mono text-[8px] text-white/25">
              <span>CLUSTER LOAD</span>
              <span>42%</span>
            </div>
            <div className="h-px bg-white/10">
              <div className="h-px w-[42%] bg-[#00CEC9]" />
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          <div className="flex flex-col justify-between gap-4 border-b border-white/10 p-5 sm:flex-row sm:items-start">
            <div>
              <div className="mb-2 flex items-center gap-2 font-mono text-[8px] uppercase tracking-[0.14em] text-white/25">
                Nodes <ChevronRight className="size-2.5" /> compute-02
              </div>
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-semibold tracking-[-0.025em] text-white">
                  compute-02
                </h3>
                <span className="border border-[#00CEC9]/30 px-2 py-0.5 font-mono text-[7px] uppercase tracking-[0.12em] text-[#00CEC9]">
                  healthy
                </span>
              </div>
              <div className="mt-1 font-mono text-[8px] text-white/25">
                192.168.10.22 · linux/amd64 · up 42d 18h
              </div>
            </div>
            <button
              type="button"
              className="inline-flex h-9 items-center justify-center gap-2 bg-[#0984E3] px-3 font-mono text-[8px] uppercase tracking-[0.1em] text-white transition hover:bg-[#1592EF]"
            >
              <TerminalSquare className="size-3" /> Open terminal
            </button>
          </div>

          <div className="grid gap-px bg-white/10 sm:grid-cols-3">
            <div className="bg-[#0B1115] p-4">
              <ResourceMeter label="CPU" value={67} detail="10.7 / 16 cores" />
            </div>
            <div className="bg-[#0B1115] p-4">
              <ResourceMeter label="Memory" value={72} detail="46 / 64 GB" />
            </div>
            <div className="bg-[#0B1115] p-4">
              <ResourceMeter label="Storage" value={44} detail="1.8 / 4 TB" />
            </div>
          </div>

          <div className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <span className="font-mono text-[8px] uppercase tracking-[0.15em] text-white/30">
                Assigned workloads / 03
              </span>
              <span className="font-mono text-[8px] text-white/20">
                Updated 2s ago
              </span>
            </div>
            <div className="overflow-x-auto border-t border-white/10">
              <div className="grid min-w-[460px] grid-cols-[1.4fr_1fr_.55fr_.65fr_.65fr] border-b border-white/[0.07] py-2 font-mono text-[7px] uppercase tracking-[0.12em] text-white/20">
                <span>Workload</span>
                <span>Team</span>
                <span>CPU</span>
                <span>Memory</span>
                <span>Status</span>
              </div>
              {workloads.map((workload) => (
                <div
                  key={workload.name}
                  className="grid min-w-[460px] grid-cols-[1.4fr_1fr_.55fr_.65fr_.65fr] items-center border-b border-white/[0.06] py-3 text-[9px] last:border-0"
                >
                  <span className="flex items-center gap-2 text-white/70">
                    <Boxes className="size-3 text-[#0984E3]" />
                    {workload.name}
                  </span>
                  <span className="text-white/35">{workload.team}</span>
                  <span className="font-mono text-white/35">
                    {workload.cpu}
                  </span>
                  <span className="font-mono text-white/35">
                    {workload.memory}
                  </span>
                  <span className="flex items-center gap-1.5 font-mono text-[7px] uppercase text-[#00CEC9]">
                    <span className="size-1 bg-[#00CEC9]" />
                    {workload.state}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="mx-5 mb-5 flex items-center justify-between border border-white/[0.07] bg-white/[0.02] px-3 py-2.5">
            <span className="flex items-center gap-2 text-[9px] text-white/40">
              <GitBranch className="size-3 text-[#00CEC9]" /> api-production
              deployed{" "}
              <strong className="font-mono font-normal text-white/60">
                a84f29c
              </strong>
            </span>
            <span className="font-mono text-[7px] text-white/20">
              18 SEC AGO
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatRail() {
  const stats = [
    ["Hardware", "Bleibt bei dir"],
    ["Zugriff", "Rollenbasiert"],
    ["Daten", "Bleiben lokal"],
    ["Scope", "Org → Container"],
  ];

  return (
    <div className="grid border-y border-white/10 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map(([label, value], index) => (
        <div
          key={label}
          className="flex items-center gap-5 border-b border-white/10 px-5 py-6 last:border-b-0 sm:border-r sm:nth-[2]:border-r-0 sm:nth-[3]:border-b-0 lg:border-b-0 lg:nth-[2]:border-r lg:last:border-r-0"
        >
          <span className="font-mono text-[9px] text-[#00CEC9]">
            0{index + 1}
          </span>
          <div>
            <div className="font-mono text-[8px] uppercase tracking-[0.14em] text-white/25">
              {label}
            </div>
            <div className="mt-1 text-sm font-medium text-white/75">
              {value}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function CapabilityRows() {
  return (
    <div className="border-t border-white/10">
      {domains.map((domain) => (
        <div
          key={domain.number}
          className="group grid gap-4 border-b border-white/10 py-6 transition hover:bg-white/[0.018] md:grid-cols-[56px_220px_1fr_130px] md:items-center md:px-4"
        >
          <span className="font-mono text-[9px] text-[#00CEC9]">
            {domain.number}
          </span>
          <div className="flex items-center gap-3">
            <domain.icon className="size-4 text-white/35 transition group-hover:text-[#00CEC9]" />
            <h3 className="text-base font-semibold tracking-[-0.02em] text-white">
              {domain.title}
            </h3>
          </div>
          <p className="max-w-2xl text-sm leading-6 text-white/40">
            {domain.text}
          </p>
          <div className="flex items-center justify-between md:justify-end md:gap-5">
            <span className="font-mono text-[8px] uppercase tracking-[0.12em] text-white/20">
              {domain.scope}
            </span>
            <ArrowRight className="size-3.5 -translate-x-1 text-white/15 transition group-hover:translate-x-0 group-hover:text-[#0984E3]" />
          </div>
        </div>
      ))}
    </div>
  );
}

function AllocationPanel() {
  const allocations = [
    { label: "Platform", color: "#0984E3", cpu: 8, ram: 32, storage: 1200 },
    { label: "Product", color: "#00CEC9", cpu: 6, ram: 24, storage: 800 },
    { label: "Shared", color: "#74B9FF", cpu: 4, ram: 16, storage: 600 },
  ];

  return (
    <div className="border border-white/10 bg-[#0B1115]">
      <div className="flex items-center justify-between border-b border-white/10 p-4">
        <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-white/40">
          Resource allocation
        </span>
        <span className="font-mono text-[8px] text-[#00CEC9]">
          CLUSTER / PRIVATE-RACK
        </span>
      </div>
      <div className="p-5">
        <div className="grid grid-cols-[1fr_58px_70px_72px] border-b border-white/10 pb-2 font-mono text-[7px] uppercase tracking-[0.12em] text-white/20">
          <span>Assigned to</span>
          <span>CPU</span>
          <span>RAM</span>
          <span>Storage</span>
        </div>
        {allocations.map((item) => (
          <div
            key={item.label}
            className="grid grid-cols-[1fr_58px_70px_72px] items-center border-b border-white/[0.07] py-4 text-[10px] last:border-0"
          >
            <span className="flex items-center gap-2 text-white/65">
              <span
                className="size-2"
                style={{ backgroundColor: item.color }}
              />
              {item.label}
            </span>
            <span className="font-mono text-white/35">{item.cpu}c</span>
            <span className="font-mono text-white/35">{item.ram} GB</span>
            <span className="font-mono text-white/35">{item.storage} GB</span>
          </div>
        ))}
        <div
          className="mt-5 grid h-8 grid-cols-[42fr_32fr_26fr] gap-0.5"
          role="img"
          aria-label="Ressourcenverteilung"
        >
          {allocations.map((item) => (
            <div
              key={item.label}
              className="grid place-items-center font-mono text-[7px] text-[#0B1115]"
              style={{ backgroundColor: item.color }}
            >
              {item.label.toUpperCase()}
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-between font-mono text-[7px] text-white/20">
          <span>0%</span>
          <span>ALLOCATED CAPACITY</span>
          <span>100%</span>
        </div>
      </div>
    </div>
  );
}

function Architecture() {
  const layers = [
    {
      number: "01",
      icon: Users,
      title: "Browser UI",
      text: "Daten, Zustände und Aktionen für Nutzer.",
    },
    {
      number: "02",
      icon: Network,
      title: "Devion API",
      text: "Authentifizierung, Regeln und Persistenz.",
    },
    {
      number: "03",
      icon: Workflow,
      title: "Control Plane",
      text: "Planung, Zuweisung und Orchestrierung.",
    },
    {
      number: "04",
      icon: Server,
      title: "Your Nodes",
      text: "Anwendungen auf deiner Infrastruktur.",
    },
  ];

  return (
    <div className="grid border border-white/10 lg:grid-cols-4">
      {layers.map((layer, index) => (
        <div
          key={layer.number}
          className="relative border-b border-white/10 p-6 last:border-b-0 lg:border-r lg:border-b-0 lg:last:border-r-0"
        >
          <div className="mb-12 flex items-center justify-between">
            <span className="font-mono text-[9px] text-[#00CEC9]">
              {layer.number}
            </span>
            <layer.icon className="size-4 text-white/25" />
          </div>
          <h3 className="text-lg font-semibold tracking-[-0.025em] text-white">
            {layer.title}
          </h3>
          <p className="mt-2 max-w-[220px] text-sm leading-6 text-white/35">
            {layer.text}
          </p>
          {index < layers.length - 1 && (
            <ArrowRight className="absolute top-1/2 -right-2.5 z-10 hidden size-5 bg-[#11191F] text-[#0984E3] lg:block" />
          )}
        </div>
      ))}
    </div>
  );
}

function PermissionMatrix() {
  const rows = [
    {
      role: "Owner",
      rights: { View: true, Edit: true, Deploy: true, Manage: true },
    },
    {
      role: "Admin",
      rights: { View: true, Edit: true, Deploy: true, Manage: true },
    },
    {
      role: "Developer",
      rights: { View: true, Edit: true, Deploy: true, Manage: false },
    },
    {
      role: "Viewer",
      rights: { View: true, Edit: false, Deploy: false, Manage: false },
    },
  ];
  const permissions = ["View", "Edit", "Deploy", "Manage"] as const;

  return (
    <div className="overflow-x-auto border border-white/10 bg-[#0B1115]">
      <div className="min-w-[520px]">
        <div className="grid grid-cols-[1.4fr_repeat(4,1fr)] border-b border-white/10 bg-white/[0.02] font-mono text-[8px] uppercase tracking-[0.12em] text-white/25">
          <span className="p-4">Role</span>
          {permissions.map((label) => (
            <span
              key={label}
              className="border-l border-white/10 p-4 text-center"
            >
              {label}
            </span>
          ))}
        </div>
        {rows.map((row) => (
          <div
            key={row.role}
            className="grid grid-cols-[1.4fr_repeat(4,1fr)] border-b border-white/[0.07] text-sm last:border-0"
          >
            <span className="flex items-center gap-3 p-4 text-white/65">
              <span className="size-1.5 bg-[#0984E3]" />
              {row.role}
            </span>
            {permissions.map((permission) => (
              <span
                key={`${row.role}-${permission}`}
                className="grid place-items-center border-l border-white/[0.07] p-4"
              >
                {row.rights[permission] ? (
                  <Check className="size-3.5 text-[#00CEC9]" />
                ) : (
                  <span className="h-px w-3 bg-white/10" />
                )}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionLabel({
  index,
  children,
}: {
  index: string;
  children: ReactNode;
}) {
  return (
    <div className="mb-8 flex items-center gap-3 font-mono text-[9px] uppercase tracking-[0.16em] text-white/30">
      <span className="text-[#00CEC9]">{index}</span>
      <span className="h-px w-8 bg-white/15" />
      {children}
    </div>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#0E151A] text-[#F5F6FA]">
      <Header />

      <section className="devion-grid border-b border-white/10">
        <div className="mx-auto max-w-[1440px] px-5 py-16 sm:px-8 sm:py-20 lg:px-12 lg:py-24">
          <div className="grid min-w-0 items-end gap-14 lg:grid-cols-[.82fr_1.18fr]">
            <div className="min-w-0 max-w-xl">
              <div className="mb-8 flex items-center gap-3 font-mono text-[9px] uppercase tracking-[0.16em] text-[#00CEC9]">
                <span className="size-1.5 bg-[#00CEC9]" /> Self-hosted
                application platform
              </div>
              <h1 className="text-balance text-[clamp(3rem,13vw,6.6rem)] font-semibold leading-[0.9] tracking-[-0.07em] text-white lg:text-[clamp(3.5rem,6.7vw,6.6rem)] lg:leading-[0.88] lg:tracking-[-0.075em]">
                Software betreiben.
                <span className="mt-2 block text-[#0984E3]">
                  Auf deiner Hardware.
                </span>
              </h1>
              <p className="mt-8 max-w-lg text-base leading-7 text-white/55 sm:text-lg sm:leading-8">
                Devion macht aus einzelnen Servern eine gemeinsame
                Betriebsplattform. Teams deployen Anwendungen, sehen Logs und
                teilen Ressourcen — du behältst Hardware und Daten.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link
                  href={repositoryUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="group inline-flex h-12 items-center justify-center gap-3 bg-[#0984E3] px-5 font-mono text-[9px] uppercase tracking-[0.12em] text-white transition hover:bg-[#1592EF]"
                >
                  Repository öffnen{" "}
                  <ArrowRight className="size-3.5 transition group-hover:translate-x-1" />
                </Link>
                <Link
                  href="#product"
                  className="inline-flex h-12 items-center justify-center gap-3 border border-white/15 px-5 font-mono text-[9px] uppercase tracking-[0.12em] text-white/60 transition hover:border-white/30 hover:text-white"
                >
                  Produkt ansehen <ChevronRight className="size-3.5" />
                </Link>
              </div>
              <div className="mt-10 flex items-center gap-3 border-l border-[#00CEC9] pl-4 font-mono text-[8px] uppercase tracking-[0.1em] text-white/25">
                <LockKeyhole className="size-3.5 text-[#00CEC9]" /> No external
                cloud required
              </div>
            </div>

            <OperationsPanel />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12">
        <StatRail />
      </div>

      <section className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <SectionLabel index="001">Warum Devion</SectionLabel>
          <div className="grid gap-10 lg:grid-cols-[1.25fr_.75fr] lg:items-end">
            <h2 className="max-w-4xl text-balance text-4xl font-semibold leading-[1.02] tracking-[-0.055em] text-white sm:text-6xl lg:text-7xl">
              Eine Plattform zwischen deinem Team und deinen Servern.
            </h2>
            <div className="border-t border-white/15 pt-5">
              <p className="text-sm leading-7 text-white/45">
                Kein neues Hosting-Angebot. Devion ist das Control Center für
                Infrastruktur, die dir bereits gehört — mit einer Oberfläche,
                die Entwickler und Betreiber gemeinsam nutzen können.
              </p>
              <div className="mt-5 flex items-center gap-2 font-mono text-[8px] uppercase tracking-[0.12em] text-[#00CEC9]">
                <CircleDot className="size-3" /> Open source / Built to extend
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        id="domains"
        className="border-y border-white/10 bg-[#0B1115] py-24 sm:py-32"
      >
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <SectionLabel index="002">Produktbereiche</SectionLabel>
          <div className="mb-14 grid gap-6 lg:grid-cols-2 lg:items-end">
            <h2 className="text-4xl font-semibold tracking-[-0.05em] text-white sm:text-5xl">
              Was du steuerst.
            </h2>
            <p className="max-w-lg text-sm leading-7 text-white/40 lg:justify-self-end">
              Domänen statt einer überladenen Oberfläche. Jeder Bereich bleibt
              verständlich, erweiterbar und klar berechtigbar.
            </p>
          </div>
          <CapabilityRows />
        </div>
      </section>

      <section className="py-24 sm:py-32">
        <div className="mx-auto grid max-w-7xl gap-14 px-5 sm:px-8 lg:grid-cols-[.78fr_1.22fr] lg:items-center">
          <div>
            <SectionLabel index="003">Ressourcen</SectionLabel>
            <h2 className="text-balance text-4xl font-semibold leading-[1.04] tracking-[-0.05em] text-white sm:text-5xl">
              Kapazität ist sichtbar. Verteilung ist Absicht.
            </h2>
            <p className="mt-6 max-w-lg text-sm leading-7 text-white/45">
              Limits schützen die Plattform vor einzelnen Workloads. Quotas
              geben Teams verlässlichen Spielraum. Shared Resources verhindern
              unnötige Silos.
            </p>
            <div className="mt-8 space-y-3 font-mono text-[9px] uppercase tracking-[0.11em] text-white/35">
              {[
                "Limits pro Team und Projekt",
                "Gemeinsame Pools über Grenzen hinweg",
                "Auslastung bis zum einzelnen Node",
              ].map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <Check className="size-3 text-[#00CEC9]" />
                  {item}
                </div>
              ))}
            </div>
          </div>
          <AllocationPanel />
        </div>
      </section>

      <section
        id="architecture"
        className="border-y border-white/10 bg-[#11191F] py-24 sm:py-32"
      >
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <SectionLabel index="004">Systemarchitektur</SectionLabel>
          <div className="mb-14 grid gap-6 lg:grid-cols-2 lg:items-end">
            <h2 className="max-w-xl text-4xl font-semibold leading-[1.04] tracking-[-0.05em] text-white sm:text-5xl">
              Frontend, Server, Nodes. Sauber getrennt.
            </h2>
            <p className="max-w-lg text-sm leading-7 text-white/40 lg:justify-self-end">
              Das UI stellt Zustände und Aktionen dar. Geschäftslogik,
              Speicherung und Verarbeitung liegen im Server. Anwendungen laufen
              auf deiner Hardware.
            </p>
          </div>
          <Architecture />
        </div>
      </section>

      <section id="permissions" className="py-24 sm:py-32">
        <div className="mx-auto grid max-w-7xl gap-14 px-5 sm:px-8 lg:grid-cols-[.75fr_1.25fr] lg:items-center">
          <div>
            <SectionLabel index="005">Access control</SectionLabel>
            <h2 className="text-balance text-4xl font-semibold leading-[1.04] tracking-[-0.05em] text-white sm:text-5xl">
              Nicht jeder darf alles. Jeder sieht, was zählt.
            </h2>
            <p className="mt-6 max-w-lg text-sm leading-7 text-white/45">
              Rollen und Berechtigungen gelten entlang der
              Organisationsstruktur. So bleibt Zusammenarbeit schnell, ohne
              Kontrolle aufzugeben.
            </p>
          </div>
          <PermissionMatrix />
        </div>
      </section>

      <section className="border-y border-white/10 bg-[#0984E3] text-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <div className="mb-6 font-mono text-[9px] uppercase tracking-[0.16em] text-white/65">
              Self-hosted by default
            </div>
            <h2 className="max-w-4xl text-balance text-4xl font-semibold leading-[1] tracking-[-0.055em] sm:text-6xl">
              Deine Infrastruktur braucht kein fremdes Dashboard.
            </h2>
          </div>
          <Link
            href={repositoryUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-12 items-center justify-center gap-3 border border-white bg-white px-5 font-mono text-[9px] uppercase tracking-[0.12em] text-[#0984E3] transition hover:bg-transparent hover:text-white"
          >
            Devion auf GitHub <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </section>

      <footer className="bg-[#0B1115]">
        <div className="mx-auto grid max-w-[1440px] gap-8 px-5 py-10 sm:px-8 md:grid-cols-[1fr_auto] md:items-end lg:px-12">
          <div>
            <Logo />
            <p className="mt-4 max-w-sm text-xs leading-5 text-white/25">
              Open-source control plane for applications running on your own
              hardware.
            </p>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-3 font-mono text-[8px] uppercase tracking-[0.12em] text-white/30">
            <Link
              href={repositoryUrl}
              target="_blank"
              rel="noreferrer"
              className="hover:text-white"
            >
              Repository
            </Link>
            <Link href="#domains" className="hover:text-white">
              Product
            </Link>
            <Link href="#architecture" className="hover:text-white">
              Architecture
            </Link>
            <span>© 2026 Devion Systems</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
