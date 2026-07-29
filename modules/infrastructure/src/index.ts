// Subsystem Namespace Exports
export * as StorageDB from "./storage/database/db.js";
export * as StorageBlob from "./storage/blob/client.js";
export * as StorageRegistry from "./storage/registry/index.js";
export * as Network from "./network/index.js";

// Storage Direct Exports
export { db, getDb, getDbPool, checkDbHealth, closeDbPool } from "./storage/database/db.js";
export * from "./storage/database/schema/schema.js";
export { blobStorage, BlobStorageClient, type ArtifactType, type StorageObjectMetadata, type UploadOptions } from "./storage/blob/client.js";
export { dockerRegistry, DockerRegistryClient, type DockerRegistryOptions, type DockerManifestV2 } from "./storage/registry/index.js";

// Network Direct Exports
export { DnsManager } from "./network/dns.js";
export { TraefikManager, type RouteTarget } from "./network/traefik.js";

// Health Manager & Aggregator
export * from "./manager.js";
