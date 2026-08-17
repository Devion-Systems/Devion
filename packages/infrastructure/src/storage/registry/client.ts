import { parseEnv, AppError, ErrorCode, getLogger } from "@repo/core";
import { registryEnvSchema } from "./config.js";

export interface DockerRegistryOptions {
  baseUrl?: string;
  username?: string;
  password?: string;
}

export interface ManifestLayer {
  mediaType: string;
  size: number;
  digest: string;
}

export interface DockerManifestV2 {
  schemaVersion: number;
  mediaType: string;
  config: ManifestLayer;
  layers: ManifestLayer[];
}

export class DockerRegistryClient {
  private baseUrl: string;
  private authHeader?: string;

  constructor(options: DockerRegistryOptions = {}) {
    const env = parseEnv(registryEnvSchema) as any;
    this.baseUrl = (options.baseUrl || (env.DOCKER_REGISTRY_URL as string) || "http://localhost:5000").replace(/\/$/, "");

    const username = options.username || (env.DOCKER_REGISTRY_USERNAME as string | undefined);
    const password = options.password || (env.DOCKER_REGISTRY_PASSWORD as string | undefined);

    if (username && password) {
      this.authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;
    }
  }

  private getLogger() {
    try {
      return getLogger();
    } catch {
      return null;
    }
  }

  public getRepositoryName(tenantId: string, imageName: string): string {
    const cleanTenant = tenantId.toLowerCase().replace(/[^a-z0-9-]/g, "-");
    const cleanImage = imageName.toLowerCase().replace(/[^a-z0-9-/_]/g, "-");
    return `${cleanTenant}/${cleanImage}`;
  }

  private async request<T = any>(
    path: string,
    options: RequestInit = {}
  ): Promise<{ data: T; headers: Headers; status: number }> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    };

    if (this.authHeader && !headers["Authorization"]) {
      headers["Authorization"] = this.authHeader;
    }

    try {
      const response = await fetch(url, { ...options, headers });

      if (!response.ok) {
        if (response.status === 404) {
          throw new AppError(
            `Docker Registry resource '${path}' not found`,
            ErrorCode.NOT_FOUND,
            404
          );
        }
        if (response.status === 401 || response.status === 403) {
          throw new AppError(
            `Docker Registry authentication/authorization failed`,
            ErrorCode.UNAUTHORIZED,
            response.status
          );
        }

        const errorText = await response.text();
        throw new AppError(
          `Docker Registry request failed [${response.status}]: ${errorText}`,
          ErrorCode.INTERNAL_ERROR,
          response.status
        );
      }

      let data: any = null;
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        data = await response.json();
      }

      return { data, headers: response.headers, status: response.status };
    } catch (err: any) {
      if (AppError.isAppError(err)) throw err;
      throw new AppError(
        `Failed to communicate with Docker Registry at '${url}'`,
        ErrorCode.SERVICE_UNAVAILABLE,
        503,
        { cause: err }
      );
    }
  }

  public async ping(): Promise<boolean> {
    try {
      const res = await this.request("/v2/");
      return res.status === 200;
    } catch {
      return false;
    }
  }

  public async listRepositories(n?: number, last?: string): Promise<string[]> {
    const params = new URLSearchParams();
    if (n) params.set("n", n.toString());
    if (last) params.set("last", last);

    const query = params.toString() ? `?${params.toString()}` : "";
    const res = await this.request<{ repositories: string[] }>(`/v2/_catalog${query}`);
    return res.data?.repositories || [];
  }

  public async listTenantRepositories(tenantId: string): Promise<string[]> {
    const all = await this.listRepositories();
    const cleanTenant = tenantId.toLowerCase().replace(/[^a-z0-9-]/g, "-");
    const prefix = `${cleanTenant}/`;
    return all.filter((repo) => repo.startsWith(prefix));
  }

  public async listTags(tenantId: string, imageName: string): Promise<string[]> {
    const repository = this.getRepositoryName(tenantId, imageName);
    try {
      const res = await this.request<{ name: string; tags: string[] }>(`/v2/${repository}/tags/list`);
      return res.data?.tags || [];
    } catch (err) {
      if (AppError.isAppError(err) && err.statusCode === 404) {
        return [];
      }
      throw err;
    }
  }

  public async getManifest(
    tenantId: string,
    imageName: string,
    tagOrDigest: string = "latest"
  ): Promise<{ manifest: DockerManifestV2; digest: string }> {
    const repository = this.getRepositoryName(tenantId, imageName);
    const res = await this.request<DockerManifestV2>(`/v2/${repository}/manifests/${tagOrDigest}`, {
      headers: {
        Accept:
          "application/vnd.docker.distribution.manifest.v2+json, application/vnd.oci.image.manifest.v1+json",
      },
    });

    const digest = res.headers.get("docker-content-digest") || tagOrDigest;
    return { manifest: res.data, digest };
  }

  public async deleteManifest(
    tenantId: string,
    imageName: string,
    digest: string
  ): Promise<void> {
    const repository = this.getRepositoryName(tenantId, imageName);
    await this.request(`/v2/${repository}/manifests/${digest}`, {
      method: "DELETE",
    });
    this.getLogger()?.info({ tenantId, imageName, digest }, `Deleted Docker image manifest`);
  }

  public async deleteTag(
    tenantId: string,
    imageName: string,
    tag: string
  ): Promise<void> {
    const { digest } = await this.getManifest(tenantId, imageName, tag);
    await this.deleteManifest(tenantId, imageName, digest);
  }

  public async hasLayer(tenantId: string, imageName: string, digest: string): Promise<boolean> {
    const repository = this.getRepositoryName(tenantId, imageName);
    try {
      const res = await this.request(`/v2/${repository}/blobs/${digest}`, {
        method: "HEAD",
      });
      return res.status === 200;
    } catch {
      return false;
    }
  }

  public async getLayerStream(
    tenantId: string,
    imageName: string,
    digest: string
  ): Promise<ReadableStream | null> {
    const repository = this.getRepositoryName(tenantId, imageName);
    const url = `${this.baseUrl}/v2/${repository}/blobs/${digest}`;
    
    const headers: Record<string, string> = {};
    if (this.authHeader) {
      headers["Authorization"] = this.authHeader;
    }

    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new AppError(
        `Failed to get layer blob '${digest}'`,
        ErrorCode.NOT_FOUND,
        response.status
      );
    }

    return response.body;
  }
}
