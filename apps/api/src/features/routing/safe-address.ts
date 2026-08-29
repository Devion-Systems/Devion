const dnsName = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;
const ipv4 = /^(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;

export function normalizeAdvertisedAddress(value: string): string {
  const address = value.trim();
  if (!address || address.length > 253 || /[/?#@\s\[\]]/.test(address) || address.includes("//")) throw new Error("Advertised address must be a host or IP without scheme, path, or port");
  if (ipv4.test(address)) return address;
  if (address.includes(":")) { try { if (new URL(`http://[${address}]`).hostname) return address.toLowerCase(); } catch { /* invalid IPv6 */ } throw new Error("Advertised address must be a valid IPv6 address"); }
  if (!dnsName.test(address)) throw new Error("Advertised address must be a valid DNS name");
  return address.toLowerCase();
}

export function workloadUpstreamUrl(protocol: "http" | "https", address: string, hostPort: number): string {
  const host = normalizeAdvertisedAddress(address);
  if (!Number.isInteger(hostPort) || hostPort < 1 || hostPort > 65_535) throw new Error("Published workload port is invalid");
  return `${protocol}://${host.includes(":") ? `[${host}]` : host}:${hostPort}`;
}
