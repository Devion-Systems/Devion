import dns from 'dns/promises';

export class DnsManager {
  constructor(private serverPublicIp: string) {}

  /**
   * Prüft, ob eine Kunden-Domain (A-Record) korrekt auf die Server-IP zeigt.
   */
  async verifyCustomDomain(domain: string): Promise<boolean> {
    try {
      const addresses = await dns.resolve(domain);
      return addresses.includes(this.serverPublicIp);
    } catch {
      return false;
    }
  }

  /**
   * Hilfreich, falls Kunden Subdomains (z.B. app.kunde.de) per CNAME auf dein System aufschalten.
   */
  async verifyCname(domain: string, targetDomain: string): Promise<boolean> {
    try {
      const addresses = await dns.resolveCname(domain);
      return addresses.includes(targetDomain);
    } catch {
      return false;
    }
  }
}
