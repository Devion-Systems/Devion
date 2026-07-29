import { cpus, loadavg, totalmem, freemem, platform } from "node:os";
import { statfsSync } from "node:fs";
import type { Logger } from "pino";
import { AppError, ErrorCode } from "../error/app-errors.js";

export interface CpuMetrics {
  cores: number;
  loadAvg1m: number;
  loadAvg5m: number;
  loadAvg15m: number;
  /** 0-100, approximate instantaneous usage sampled over `sampleMs`. */
  usagePercent: number;
  model: string;
}

export interface RamMetrics {
  totalBytes: number;
  freeBytes: number;
  usedBytes: number;
  usagePercent: number;
}

export interface GpuMetrics {
  available: boolean;
  devices: Array<{
    name: string;
    utilizationPercent: number;
    memoryTotalMb: number;
    memoryUsedMb: number;
    temperatureC?: number;
  }>;
}

export interface StorageMetrics {
  path: string;
  totalBytes: number;
  freeBytes: number;
  usedBytes: number;
  usagePercent: number;
}

export interface SystemSnapshot {
  timestamp: string;
  cpu: CpuMetrics;
  ram: RamMetrics;
  gpu: GpuMetrics;
  storage: StorageMetrics[];
}

export interface SystemWatcherOptions {
  logger?: Logger;
  /** Paths to report storage usage for. Default: ["/"] (or "C:\\" on Windows). */
  storagePaths?: string[];
  /** How long to sample CPU ticks over when computing usagePercent. Default 200ms. */
  cpuSampleMs?: number;
  /** Disable GPU polling entirely (e.g. no nvidia-smi on this box). Default: auto-detect. */
  enableGpu?: boolean;
}

function cpuTimesSnapshot() {
  return cpus().map((c) => c.times);
}

async function measureCpuUsage(sampleMs: number): Promise<number> {
  const start = cpuTimesSnapshot();
  await Bun.sleep(sampleMs);
  const end = cpuTimesSnapshot();

  let idleDelta = 0;
  let totalDelta = 0;
  for (let i = 0; i < start.length; i++) {
    const s = start[i]!;
    const e = end[i]!;
    const totalStart = s.user + s.nice + s.sys + s.idle + s.irq;
    const totalEnd = e.user + e.nice + e.sys + e.idle + e.irq;
    idleDelta += e.idle - s.idle;
    totalDelta += totalEnd - totalStart;
  }
  if (totalDelta <= 0) return 0;
  return Math.round((1 - idleDelta / totalDelta) * 1000) / 10;
}

function readRam(): RamMetrics {
  const totalBytes = totalmem();
  const freeBytes = freemem();
  const usedBytes = totalBytes - freeBytes;
  return {
    totalBytes,
    freeBytes,
    usedBytes,
    usagePercent: Math.round((usedBytes / totalBytes) * 1000) / 10,
  };
}

function readStorage(path: string): StorageMetrics {
  const stats = statfsSync(path);
  const totalBytes = stats.blocks * stats.bsize;
  const freeBytes = stats.bfree * stats.bsize;
  const usedBytes = totalBytes - freeBytes;
  return {
    path,
    totalBytes,
    freeBytes,
    usedBytes,
    usagePercent: totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 1000) / 10 : 0,
  };
}

let gpuAvailableCache: boolean | undefined;

function detectGpu(): boolean {
  if (gpuAvailableCache !== undefined) return gpuAvailableCache;
  try {
    const result = Bun.spawnSync(["nvidia-smi", "-L"]);
    gpuAvailableCache = result.exitCode === 0;
  } catch {
    gpuAvailableCache = false;
  }
  return gpuAvailableCache;
}

function readGpu(): GpuMetrics {
  if (!detectGpu()) return { available: false, devices: [] };

  try {
    const query = [
      "nvidia-smi",
      "--query-gpu=name,utilization.gpu,memory.total,memory.used,temperature.gpu",
      "--format=csv,noheader,nounits",
    ];
    const result = Bun.spawnSync(query);
    if (result.exitCode !== 0) return { available: false, devices: [] };

    const text = new TextDecoder().decode(result.stdout).trim();
    if (!text) return { available: true, devices: [] };

    const devices = text.split("\n").map((line) => {
      const [name, util, memTotal, memUsed, temp] = line.split(",").map((s) => s.trim());
      return {
        name: name ?? "unknown",
        utilizationPercent: Number(util) || 0,
        memoryTotalMb: Number(memTotal) || 0,
        memoryUsedMb: Number(memUsed) || 0,
        temperatureC: temp ? Number(temp) || undefined : undefined,
      };
    });

    return { available: true, devices };
  } catch {
    return { available: false, devices: [] };
  }
}

export class SystemWatcher {
  private logger?: Logger;
  private storagePaths: string[];
  private cpuSampleMs: number;
  private gpuEnabled: boolean;

  constructor(opts: SystemWatcherOptions = {}) {
    this.logger = opts.logger;
    this.storagePaths = opts.storagePaths ?? [platform() === "win32" ? "C:\\" : "/"];
    this.cpuSampleMs = opts.cpuSampleMs ?? 200;
    this.gpuEnabled = opts.enableGpu ?? detectGpu();
  }

  async cpu(): Promise<CpuMetrics> {
    const [load1, load5, load15] = loadavg();
    const list = cpus();
    return {
      cores: list.length,
      model: list[0]?.model ?? "unknown",
      loadAvg1m: load1 ?? 0,
      loadAvg5m: load5 ?? 0,
      loadAvg15m: load15 ?? 0,
      usagePercent: await measureCpuUsage(this.cpuSampleMs),
    };
  }

  ram(): RamMetrics {
    return readRam();
  }

  gpu(): GpuMetrics {
    if (!this.gpuEnabled) return { available: false, devices: [] };
    return readGpu();
  }

  storage(): StorageMetrics[] {
    return this.storagePaths.map((path) => {
      try {
        return readStorage(path);
      } catch (err) {
        this.logger?.warn({ path, err }, "Failed to read storage metrics");
        throw new AppError(`Failed to read storage metrics for ${path}`, ErrorCode.SYSTEM_METRIC_FAILED, 500, {
          cause: err,
        });
      }
    });
  }

  /** Full snapshot across CPU, RAM, GPU, and storage. Takes ~cpuSampleMs to resolve. */
  async snapshot(): Promise<SystemSnapshot> {
    const [cpu, storage] = await Promise.all([this.cpu(), Promise.resolve(this.storage())]);
    return {
      timestamp: new Date().toISOString(),
      cpu,
      ram: this.ram(),
      gpu: this.gpu(),
      storage,
    };
  }
}