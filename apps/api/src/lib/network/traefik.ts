import fs from "node:fs/promises";
import path from "node:path";

export type TraefikDomain = {
  id: string;
  hostname: string;
  upstreams: Array<{ url: string }>;
};

export type ProjectRouteTarget = {
  projectId: string;
};

export type TraefikSettings = {
  dynamicConfigDir: string;
  httpEntryPoint: string;
  httpsEntryPoint: string;
  certResolver: string;
  internalDomain?: string;
};

const safeIdentifier = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, "-");
const hostnamePattern = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

function assertHostname(hostname: string) {
  const normalized = hostname.trim().toLowerCase();
  if (!hostnamePattern.test(normalized)) throw new Error("Invalid Traefik hostname");
  return normalized;
}

function assertUpstream(url: string) {
  const parsed = new URL(url);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Traefik upstream must use HTTP or HTTPS");
  }
  if (
    parsed.username ||
    parsed.password ||
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error("Traefik upstream must be a bare internal service URL");
  }
  return parsed.toString().replace(/\/$/, "");
}

/**
 * Writes Traefik file-provider configuration. Only server-owned deployment
 * metadata may provide an upstream URL; customer input is limited to hostnames.
 */
export class TraefikManager {
  private readonly settings: TraefikSettings;

  constructor(settings: Partial<TraefikSettings> = {}) {
    this.settings = {
      dynamicConfigDir:
        settings.dynamicConfigDir ??
        process.env.TRAEFIK_DYNAMIC_CONFIG_DIR ??
        "/opt/devion/traefik/dynamic",
      httpEntryPoint: settings.httpEntryPoint ?? process.env.TRAEFIK_HTTP_ENTRYPOINT ?? "web",
      httpsEntryPoint:
        settings.httpsEntryPoint ?? process.env.TRAEFIK_HTTPS_ENTRYPOINT ?? "websecure",
      certResolver: settings.certResolver ?? process.env.TRAEFIK_CERT_RESOLVER ?? "le-kunden",
      internalDomain: (() => {
        const configured = settings.internalDomain ?? process.env.TRAEFIK_INTERNAL_DOMAIN;
        return configured?.trim() ? assertHostname(configured) : undefined;
      })(),
    };
  }

  /** Reconciles every hostname of a project into one atomically-written file. */
  async syncProjectRoutes(target: ProjectRouteTarget, domains: TraefikDomain[]): Promise<void> {
    const projectKey = safeIdentifier(target.projectId);
    const routers: Record<string, unknown> = {};
    const services: Record<string, unknown> = {};

    for (const domain of domains) {
      if (domain.upstreams.length === 0) continue;
      const serviceName = `domain-${projectKey}-${safeIdentifier(domain.id)}`;
      const hostname = assertHostname(domain.hostname);
      const routeKey = `${projectKey}-${safeIdentifier(domain.id)}`;
      services[serviceName] = {
        loadBalancer: { servers: domain.upstreams.map((upstream) => ({ url: assertUpstream(upstream.url) })) },
      };
      const httpsRouter: Record<string, unknown> = {
        rule: `Host(\`${hostname}\`)`,
        entryPoints: [this.settings.httpsEntryPoint],
        service: serviceName,
        tls: { certResolver: this.settings.certResolver },
      };
      routers[`https-${routeKey}`] = httpsRouter;
      routers[`http-${routeKey}`] = {
        rule: `Host(\`${hostname}\`)`,
        entryPoints: [this.settings.httpEntryPoint],
        middlewares: ["redirect-to-https"],
        service: serviceName,
      };
    }

    await this.writeConfig(`project-${projectKey}.json`, {
      http: {
        middlewares: {
          "redirect-to-https": { redirectScheme: { scheme: "https", permanent: true } },
        },
        routers,
        services,
      },
    });
  }

  async removeProjectRoutes(projectId: string): Promise<void> {
    const filename = `project-${safeIdentifier(projectId)}.json`;
    await fs.rm(path.join(this.settings.dynamicConfigDir, filename), { force: true });
  }

  private async writeConfig(filename: string, data: unknown): Promise<void> {
    await fs.mkdir(this.settings.dynamicConfigDir, { recursive: true });
    const destination = path.join(this.settings.dynamicConfigDir, filename);
    const temporary = `${destination}.${crypto.randomUUID()}.tmp`;
    // JSON is a supported Traefik file-provider format and avoids building YAML
    // from runtime values.
    await fs.writeFile(temporary, `${JSON.stringify(data, null, 2)}\n`, "utf8");
    await fs.rename(temporary, destination);
  }
}
