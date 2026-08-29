const dnsName = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;
const ipv4 = /^(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;

function isUnsafeIpv4(address: string): boolean {
  const [first, second] = address.split(".").map(Number);
  return first === 0 || first === 127 || first >= 224 || (first === 169 && second === 254);
}

function isUnsafeIpv6(address: string): boolean {
  const normalized = address.toLowerCase();
  return normalized === "::" || normalized === "::1" || normalized.startsWith("fe80:") || normalized.startsWith("ff");
}

export function normalizeAdvertisedAddress(value: string): string {
  const address = value.trim();
  if (!address || address.length > 253 || /[/?#@\s\[\]]/.test(address) || address.includes("//")) throw new Error("Advertised address must be a host or IP without scheme, path, or port");
  if (ipv4.test(address)) {
    if (isUnsafeIpv4(address)) throw new Error("Advertised address must not be a loopback, link-local, or multicast address");
    return address;
  }
  if (address.includes(":")) {
    try {
      if (new URL(`http://[${address}]`).hostname) {
        if (isUnsafeIpv6(address)) throw new Error("Advertised address must not be a loopback, link-local, or multicast address");
        return address.toLowerCase();
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes("loopback")) throw error;
    }
    throw new Error("Advertised address must be a valid IPv6 address");
  }
  if (!dnsName.test(address)) throw new Error("Advertised address must be a valid DNS name");
  if (address.toLowerCase() === "localhost" || address.toLowerCase().endsWith(".localhost")) throw new Error("Advertised address must not be localhost");
  return address.toLowerCase();
}

export function workloadUpstreamUrl(protocol: "http" | "https", address: string, hostPort: number): string {
  const host = normalizeAdvertisedAddress(address);
  if (!Number.isInteger(hostPort) || hostPort < 1 || hostPort > 65_535) throw new Error("Published workload port is invalid");
  return `${protocol}://${host.includes(":") ? `[${host}]` : host}:${hostPort}`;
}
