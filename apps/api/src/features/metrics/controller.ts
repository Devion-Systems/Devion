import type { Logger } from "pino";
import { PostgresWorkloadMetricsProvider } from "./postgres-provider.js";

let timer: ReturnType<typeof setInterval> | undefined;
export function startMetricsRetentionController(logger: Logger, intervalMs = 60 * 60_000): void {
  if (timer) return;
  const tick = async () => {
    try {
      const provider = new PostgresWorkloadMetricsProvider();
      const before = new Date(Date.now() - 7 * 24 * 60 * 60_000);
      let deleted = 0;
      // A bounded catch-up prevents one hourly run from monopolising the metrics table.
      for (let batch = 0; batch < 20; batch += 1) {
        const count = await provider.deleteExpired(before);
        deleted += count;
        if (count < 10_000) break;
      }
      if (deleted) logger.info({ deleted }, "Expired workload metrics removed");
    } catch (error) { logger.error({ error }, "Workload metric retention failed"); }
  };
  timer = setInterval(() => void tick(), intervalMs); void tick();
}
export function stopMetricsRetentionController(): void { if (timer) clearInterval(timer); timer = undefined; }
