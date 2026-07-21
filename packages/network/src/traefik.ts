import fs from 'fs/promises';
import path from 'path';
import YAML from 'yaml';

export interface RouteTarget {
  id: string;        // Eindeutige ID (z. B. Projekt- oder Deployment-ID)
  targetUrl: string; // Die interne IP/URL der Firecracker VM oder des Containers (z.B. http://10.0.0.45:8080)
}

export class TraefikManager {
  private dynamicConfigDir = '/opt/devion/traefik/dynamic';

  /**
   * Erstellt eine interne Route unter *.devion.local mit selbstsigniertem SSL
   */
  async createInternalRoute(target: RouteTarget, subdomain: string): Promise<void> {
    const filename = `${target.id}-internal.yml`;
    const config = {
      http: {
        routers: {
          [`router-${target.id}-internal`]: {
            rule: `Host(\`${subdomain}.devion.local\`)`,
            entryPoints: ['websecure'],
            service: `service-${target.id}`,
            tls: {} // Leeres Objekt aktiviert standardmäßiges TLS (selbstsigniert)
          }
        },
        services: {
          [`service-${target.id}`]: {
            loadBalancer: {
              servers: [{ url: target.targetUrl }]
            }
          }
        }
      }
    };

    await this.writeYaml(filename, config);
  }

  /**
   * Erstellt eine externe Kunden-Route mit automatischer Let's Encrypt Validierung
   */
  async createCustomerRoute(target: RouteTarget, customDomain: string): Promise<void> {
    const filename = `${target.id}-custom.yml`;
    const config = {
      http: {
        routers: {
          [`router-${target.id}-custom`]: {
            rule: `Host(\`${customDomain}\`, \`www.${customDomain}\`)`,
            entryPoints: ['websecure'],
            service: `service-${target.id}`,
            tls: {
              certResolver: 'le-kunden' // Verweist auf den Resolver in der statischen traefik.yml
            }
          }
        },
        services: {
          [`service-${target.id}`]: {
            loadBalancer: {
              servers: [{ url: target.targetUrl }]
            }
          }
        }
      }
    };

    await this.writeYaml(filename, config);
  }

  /**
   * Löscht alle Routing-Dateien eines Projekts, wenn die App gestoppt oder gelöscht wird
   */
  async removeRoutes(targetId: string): Promise<void> {
    const internalPath = path.join(this.dynamicConfigDir, `${targetId}-internal.yml`);
    const customPath = path.join(this.dynamicConfigDir, `${targetId}-custom.yml`);

    await fs.rm(internalPath, { force: true });
    await fs.rm(customPath, { force: true });
  }

  private async writeYaml(filename: string, data: any): Promise<void> {
    const filePath = path.join(this.dynamicConfigDir, filename);
    const yamlString = YAML.stringify(data);
    await fs.writeFile(filePath, yamlString, 'utf8');
  }
}