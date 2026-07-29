import { DockerRegistryClient } from "./client.js";

export * from "./config.js";
export * from "./client.js";

export const dockerRegistry = new DockerRegistryClient();
