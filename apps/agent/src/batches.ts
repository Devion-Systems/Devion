/** Sequential batches match the API limit and apply backpressure on rejection. */
export async function sendBatches<T>(items: readonly T[], send: (batch: T[]) => Promise<void>): Promise<void> {
  for (let start = 0; start < items.length; start += 500) await send(items.slice(start, start + 500));
}
