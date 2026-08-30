export const DYNAMIC_HOST_PORT_MIN = 30_000;
export const DYNAMIC_HOST_PORT_MAX = 39_999;

// Bound by Devion or fundamental host services. This is deliberately central
// so no route, scheduler, or dashboard can silently widen the allowed set.
export const RESERVED_HOST_PORTS = new Set([22, 80, 443, 3000, 3001, 5432]);

export type PortProtocol = "tcp" | "udp";

export function hostPortPolicyError(port: number): string | null {
  if (!Number.isInteger(port) || port < 1 || port > 65_535) return "INVALID_PORT";
  if (port < 1024) return "PRIVILEGED_PORT_FORBIDDEN";
  if (RESERVED_HOST_PORTS.has(port)) return "RESERVED_PORT";
  return null;
}

export function chooseDynamicHostPort(occupied: ReadonlySet<number>, seed: string): number | null {
  const size = DYNAMIC_HOST_PORT_MAX - DYNAMIC_HOST_PORT_MIN + 1;
  let offset = 0;
  for (const character of seed) offset = (offset * 31 + character.charCodeAt(0)) % size;
  for (let attempt = 0; attempt < size; attempt += 1) {
    const port = DYNAMIC_HOST_PORT_MIN + ((offset + attempt) % size);
    if (!occupied.has(port) && !RESERVED_HOST_PORTS.has(port)) return port;
  }
  return null;
}
