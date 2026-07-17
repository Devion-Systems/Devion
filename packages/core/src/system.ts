import os from "node:os";

interface SystemStats {
  os: {
    type: string;
    release: string;
    arch: string;
    hostname: string;
    uptimeSeconds: number;
  };
  cpu: {
    model: string;
    cores: number;
    usagePercent: number;
  };
  memory: {
    totalGB: number;
    usedGB: number;
    freeGB: number;
    usagePercent: number;
  };
}

// Hilfsfunktion zur Berechnung der CPU-Auslastung über ein kurzes Intervall (500ms)
function getCpuUsage(intervalMs: number = 500): Promise<number> {
  const startMeasure = os.cpus().map(cpu => cpu.times);
  
  return new Promise((resolve) => {
    setTimeout(() => {
      const endMeasure = os.cpus().map(cpu => cpu.times);
      let totalIdle = 0;
      let totalTick = 0;

      for (let i = 0; i < startMeasure.length; i++) {
        const start = startMeasure[i];
        const end = endMeasure[i];
        
        const idle = end.idle - start.idle;
        const total = (end.user - start.user) + 
                      (end.nice - start.nice) + 
                      (end.sys - start.sys) + 
                      (end.irq - start.irq) + 
                      (end.idle - start.idle);
        
        totalIdle += idle;
        totalTick += total;
      }

      const percentage = 100 - (totalIdle / totalTick * 100);
      resolve(Number(percentage.toFixed(1)));
    }, intervalMs);
  });
}

/**
 * Holt alle Systemmetriken und gibt sie als strukturiertes JSON-Objekt zurück.
 * Perfekt geeignet, um direkt in API-Endpoints eingebaut zu werden.
 */
export async function getSystemStats(): Promise<SystemStats> {
  const bytesToGB = (bytes: number) => Number((bytes / (1024 ** 3)).toFixed(2));
  
  const cpuUsage = await getCpuUsage(500); // 500ms reicht für APIs, um nicht zu blockieren
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const memUsagePercent = Number(((usedMem / totalMem) * 100).toFixed(1));

  return {
    os: {
      type: os.type(),
      release: os.release(),
      arch: os.arch(),
      hostname: os.hostname(),
      uptimeSeconds: os.uptime(),
    },
    cpu: {
      model: os.cpus()[0].model,
      cores: os.cpus().length,
      usagePercent: cpuUsage,
    },
    memory: {
      totalGB: bytesToGB(totalMem),
      usedGB: bytesToGB(usedMem),
      freeGB: bytesToGB(freeMem),
      usagePercent: memUsagePercent,
    }
  };
}