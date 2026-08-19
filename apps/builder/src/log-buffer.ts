import type { LogEntry } from "./domain.ts";
import type { RunRepository } from "./repository.ts";

type PendingLog = Omit<LogEntry, "id" | "createdAt">;

/** Batches high-volume BuildKit output to prevent one database round-trip per line. */
export class LogBuffer {
  private readonly entries: PendingLog[] = [];
  private timer: ReturnType<typeof setTimeout> | undefined;
  private flushing: Promise<void> = Promise.resolve();

  constructor(private readonly repository: RunRepository, private readonly maxEntries = 100, private readonly intervalMs = 50) {}

  append(entry: PendingLog): void {
    this.entries.push(entry);
    if (this.entries.length >= this.maxEntries) void this.flush();
    else if (!this.timer) this.timer = setTimeout(() => void this.flush(), this.intervalMs);
  }

  async flush(): Promise<void> {
    if (this.timer) { clearTimeout(this.timer); this.timer = undefined; }
    const entries = this.entries.splice(0);
    if (!entries.length) return this.flushing;
    this.flushing = this.flushing.then(() => this.repository.appendLogs(entries));
    return this.flushing;
  }
}
