import {
  CheckCircle2,
  CircleHelp,
  Clock3,
  OctagonAlert,
  PauseCircle,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type ResourceStatus =
  | "healthy" | "ready" | "deploying" | "starting" | "degraded"
  | "failed" | "failing" | "stopped" | "idle" | "unknown"
  | "queued" | "running" | "pushing" | "succeeded" | "cancelled" | "active" | "archived" | "stopping" | "superseded" | "scheduling";

const config: Record<ResourceStatus, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  healthy: { label: "Gesund", className: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300", icon: CheckCircle2 },
  ready: { label: "Bereit", className: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300", icon: CheckCircle2 },
  deploying: { label: "Wird ausgerollt", className: "border-sky-400/20 bg-sky-400/10 text-sky-300", icon: Clock3 },
  starting: { label: "Startet", className: "border-sky-400/20 bg-sky-400/10 text-sky-300", icon: Clock3 },
  degraded: { label: "Beeinträchtigt", className: "border-amber-400/20 bg-amber-400/10 text-amber-300", icon: OctagonAlert },
  failed: { label: "Fehlgeschlagen", className: "border-red-400/20 bg-red-400/10 text-red-300", icon: XCircle },
  failing: { label: "Fehler", className: "border-red-400/20 bg-red-400/10 text-red-300", icon: XCircle },
  stopped: { label: "Gestoppt", className: "border-zinc-400/20 bg-zinc-400/10 text-zinc-300", icon: PauseCircle },
  idle: { label: "Inaktiv", className: "border-zinc-400/20 bg-zinc-400/10 text-zinc-300", icon: PauseCircle },
  unknown: { label: "Unbekannt", className: "border-zinc-400/20 bg-zinc-400/10 text-zinc-300", icon: CircleHelp },
  queued: { label: "In Warteschlange", className: "border-sky-400/20 bg-sky-400/10 text-sky-300", icon: Clock3 },
  scheduling: { label: "Wird geplant", className: "border-sky-400/20 bg-sky-400/10 text-sky-300", icon: Clock3 },
  stopping: { label: "Wird gestoppt", className: "border-zinc-400/20 bg-zinc-400/10 text-zinc-300", icon: PauseCircle },
  superseded: { label: "Ersetzt", className: "border-zinc-400/20 bg-zinc-400/10 text-zinc-300", icon: PauseCircle },
  running: { label: "Build läuft", className: "border-sky-400/20 bg-sky-400/10 text-sky-300", icon: Clock3 },
  pushing: { label: "Image Push", className: "border-violet-400/20 bg-violet-400/10 text-violet-300", icon: Clock3 },
  succeeded: { label: "Erfolgreich", className: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300", icon: CheckCircle2 },
  cancelled: { label: "Abgebrochen", className: "border-zinc-400/20 bg-zinc-400/10 text-zinc-300", icon: PauseCircle },
  active: { label: "Aktiv", className: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300", icon: CheckCircle2 },
  archived: { label: "Archiviert", className: "border-zinc-400/20 bg-zinc-400/10 text-zinc-300", icon: PauseCircle },
};

export function ResourceStatusBadge({ status, className }: { status?: string | null; className?: string }) {
  const item = config[status as ResourceStatus] ?? config.unknown;
  const Icon = item.icon;
  return <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium", item.className, className)}><Icon className="size-3" aria-hidden="true" />{item.label}</span>;
}
