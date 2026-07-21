export interface CatalogResponse {
  repositories: string[];
}

export interface TagListResponse {
  name: string;
  tags: string[] | null;
}

export interface ImageManifest {
  schemaVersion: number;
  name: string;
  tag: string;
  architecture: string;
  fsLayers: Array<{ blobSum: string }>;
  history: Array<{ v1Compatibility: string }>;
}

export interface RegistryConfig {
  baseUrl: string; // z.B. "http://registry.devion.local:5000" oder "http://Devion-Registry:5000"
  authHeader?: string; // Optional für spätere Basic-Auth / Token-Auth
}