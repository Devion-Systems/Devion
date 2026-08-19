import dns from "node:dns/promises";

const hostnamePattern = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

function normalizeHostname(value: string) {
  const normalized = value.trim().toLowerCase().replace(/\.$/, "");
  if (!hostnamePattern.test(normalized)) throw new Error("Invalid hostname");
  return normalized;
}

/** DNS ownership checks for custom domains. */
export class DnsManager {
  constructor(
    private readonly serverPublicIp?: string,
    private readonly cnameTarget?: string,
  ) {}

  async verifyCustomDomain(domain: string): Promise<boolean> {
    const expectedIp = this.serverPublicIp;
    if (!expectedIp) return false;
    const hostname = normalizeHostname(domain);
    const [ipv4, ipv6] = await Promise.allSettled([dns.resolve4(hostname), dns.resolve6(hostname)]);
    return [ipv4, ipv6].some(
      (result) => result.status === "fulfilled" && result.value.includes(expectedIp),
    );
  }

  async verifyCname(domain: string, targetDomain = this.cnameTarget): Promise<boolean> {
    if (!targetDomain) return false;
    const hostname = normalizeHostname(domain);
    const target = normalizeHostname(targetDomain);
    try {
      const records = await dns.resolveCname(hostname);
      return records.some((record) => record.toLowerCase().replace(/\.$/, "") === target);
    } catch {
      return false;
    }
  }

  async verifyDomain(domain: string): Promise<boolean> {
    const [aRecord, cname] = await Promise.allSettled([
      this.verifyCustomDomain(domain),
      this.verifyCname(domain),
    ]);
    return (
      (aRecord.status === "fulfilled" && aRecord.value) ||
      (cname.status === "fulfilled" && cname.value)
    );
  }
}
