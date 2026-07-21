import { CatalogResponse, TagListResponse, ImageManifest, RegistryConfig } from './types';

export class RegistryClient {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(config: RegistryConfig) {
    // Entfernt abschließende Slashes
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.headers = {
      'Accept': 'application/vnd.docker.distribution.manifest.v2+json, application/json'
    };

    if (config.authHeader) {
      this.headers['Authorization'] = config.authHeader;
    }
  }

  /**
   * Prüft, ob die Docker Registry erreichbar und gesund ist
   */
  async ping(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/v2/`, { headers: this.headers });
      return res.status === 200;
    } catch {
      return false;
    }
  }

  /**
   * Listet alle in der Registry gespeicherten Image-Repositories auf
   */
  async listRepositories(): Promise<string[]> {
    const res = await fetch(`${this.baseUrl}/v2/_catalog`, { headers: this.headers });
    if (!res.ok) throw new Error(`Registry error: ${res.statusText}`);
    
    const data = (await res.json()) as CatalogResponse;
    return data.repositories || [];
  }

  /**
   * Holt alle vergebenen Tags für ein bestimmtes Repository (z.B. "kunde-a/projekt-1")
   */
  async listTags(repository: string): Promise<string[]> {
    const res = await fetch(`${this.baseUrl}/v2/${repository}/tags/list`, { headers: this.headers });
    if (res.status === 404) return []; // Repository noch nicht vorhanden
    if (!res.ok) throw new Error(`Failed to fetch tags for ${repository}: ${res.statusText}`);

    const data = (await res.json()) as TagListResponse;
    return data.tags || [];
  }

  /**
   * Liest das Manifest eines Images (z.B. Tag "latest" oder ein Commit-SHA)
   */
  async getManifest(repository: string, tagOrDigest: string): Promise<ImageManifest> {
    const res = await fetch(`${this.baseUrl}/v2/${repository}/manifests/${tagOrDigest}`, {
      headers: this.headers
    });

    if (!res.ok) throw new Error(`Manifest not found: ${res.statusText}`);
    return (await res.json()) as ImageManifest;
  }

  /**
   * Holt den Docker-Content-Digest (SHA256 Hash) eines Tags.
   * Wichtig zum Löschen von Images!
   */
  async getDigest(repository: string, tag: string): Promise<string | null> {
    const res = await fetch(`${this.baseUrl}/v2/${repository}/manifests/${tag}`, {
      method: 'HEAD',
      headers: this.headers
    });

    if (!res.ok) return null;
    return res.headers.get('Docker-Content-Digest');
  }

  /**
   * Löscht ein bestimmtes Image über seinen Digest aus der Registry (Speicherplatz-Freigabe)
   */
  async deleteImageByDigest(repository: string, digest: string): Promise<boolean> {
    const res = await fetch(`${this.baseUrl}/v2/${repository}/manifests/${digest}`, {
      method: 'DELETE',
      headers: this.headers
    });

    return res.status === 202; // 202 Accepted bedeutet erfolgreich gelöscht
  }

  /**
   * Löscht einen Tag komfortabel über seinen Namen
   */
  async deleteTag(repository: string, tag: string): Promise<boolean> {
    const digest = await this.getDigest(repository, tag);
    if (!digest) return false;
    return this.deleteImageByDigest(repository, digest);
  }
}