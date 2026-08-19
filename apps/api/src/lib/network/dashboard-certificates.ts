import { createPrivateKey, createPublicKey, timingSafeEqual, X509Certificate } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const MAX_CERTIFICATE_BYTES = 256 * 1024;
const MAX_PRIVATE_KEY_BYTES = 64 * 1024;

export type DashboardCertificateStatus = {
  installed: boolean;
  subject?: string;
  subjectAltName?: string;
  validFrom?: string;
  validTo?: string;
  fingerprint256?: string;
};

function publicKeyDer(key: ReturnType<typeof createPublicKey>) {
  return key.export({ type: "spki", format: "der" });
}

function validateCertificatePair(certificatePem: string, privateKeyPem: string) {
  if (
    Buffer.byteLength(certificatePem, "utf8") > MAX_CERTIFICATE_BYTES ||
    Buffer.byteLength(privateKeyPem, "utf8") > MAX_PRIVATE_KEY_BYTES
  ) {
    throw new Error("Certificate upload exceeds the allowed size");
  }
  const certificateBlocks = certificatePem.match(
    /-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g,
  );
  if (!certificateBlocks?.length) throw new Error("A PEM certificate is required");

  const certificate = new X509Certificate(certificateBlocks[0]);
  const privateKey = createPrivateKey(privateKeyPem);
  const certificatePublicKey = publicKeyDer(certificate.publicKey);
  const privatePublicKey = publicKeyDer(createPublicKey(privateKey));
  if (
    certificatePublicKey.length !== privatePublicKey.length ||
    !timingSafeEqual(certificatePublicKey, privatePublicKey)
  ) {
    throw new Error("Certificate and private key do not match");
  }

  const now = Date.now();
  if (Date.parse(certificate.validFrom) > now || Date.parse(certificate.validTo) <= now) {
    throw new Error("Certificate is not currently valid");
  }
  return certificate;
}

/**
 * Installs a dashboard certificate for Traefik's file provider. Private keys
 * stay on the server filesystem and are never returned through the API.
 */
export class DashboardCertificateManager {
  private readonly certificateDir = process.env.TRAEFIK_CERTS_DIR ?? "/opt/devion/traefik/certs";
  private readonly traefikCertificateDir =
    process.env.TRAEFIK_CERTS_TRAEFIK_DIR ?? "/etc/traefik/certs";
  private readonly dynamicConfigDir =
    process.env.TRAEFIK_DYNAMIC_CONFIG_DIR ?? "/opt/devion/traefik/dynamic";
  private readonly certificatePath = path.join(this.certificateDir, "dashboard.crt");
  private readonly privateKeyPath = path.join(this.certificateDir, "dashboard.key");

  async install(
    certificatePem: string,
    privateKeyPem: string,
  ): Promise<DashboardCertificateStatus> {
    const certificate = validateCertificatePair(certificatePem, privateKeyPem);
    await fs.mkdir(this.certificateDir, { recursive: true, mode: 0o700 });
    await fs.mkdir(this.dynamicConfigDir, { recursive: true, mode: 0o700 });

    await this.atomicWrite(this.certificatePath, certificatePem, 0o644);
    await this.atomicWrite(this.privateKeyPath, privateKeyPem, 0o600);
    await this.atomicWrite(
      path.join(this.dynamicConfigDir, "dashboard-certificate.json"),
      `${JSON.stringify(
        {
          tls: {
            certificates: [
              {
                certFile: path.posix.join(
                  this.traefikCertificateDir.replace(/\\/g, "/"),
                  "dashboard.crt",
                ),
                keyFile: path.posix.join(
                  this.traefikCertificateDir.replace(/\\/g, "/"),
                  "dashboard.key",
                ),
              },
            ],
          },
        },
        null,
        2,
      )}\n`,
      0o600,
    );
    return this.toStatus(certificate);
  }

  async getStatus(): Promise<DashboardCertificateStatus> {
    try {
      const certificate = new X509Certificate(await fs.readFile(this.certificatePath, "utf8"));
      await fs.access(this.privateKeyPath);
      return this.toStatus(certificate);
    } catch {
      return { installed: false };
    }
  }

  private toStatus(certificate: X509Certificate): DashboardCertificateStatus {
    return {
      installed: true,
      subject: certificate.subject,
      subjectAltName: certificate.subjectAltName,
      validFrom: new Date(certificate.validFrom).toISOString(),
      validTo: new Date(certificate.validTo).toISOString(),
      fingerprint256: certificate.fingerprint256,
    };
  }

  private async atomicWrite(filePath: string, contents: string, mode: number) {
    const temporary = `${filePath}.${crypto.randomUUID()}.tmp`;
    await fs.writeFile(temporary, contents, { encoding: "utf8", mode });
    await fs.chmod(temporary, mode);
    await fs.rename(temporary, filePath);
  }
}
