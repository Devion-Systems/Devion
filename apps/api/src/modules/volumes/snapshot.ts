export type ManagedVolumeMount = { volumeId: string; mountPath: string; readOnly: boolean };

/** Extract managed references from an immutable deployment runtime snapshot. */
export function managedVolumeMounts(runtimeConfig: unknown): ManagedVolumeMount[] {
  if (!runtimeConfig || typeof runtimeConfig !== "object" || !Array.isArray((runtimeConfig as { volumes?: unknown }).volumes)) return [];
  return (runtimeConfig as { volumes: unknown[] }).volumes.flatMap((volume) => {
    if (!volume || typeof volume !== "object") return [];
    const item = volume as { id?: unknown; target?: unknown; readOnly?: unknown };
    return typeof item.id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(item.id) && typeof item.target === "string"
      ? [{ volumeId: item.id, mountPath: item.target, readOnly: item.readOnly === true }]
      : [];
  });
}
