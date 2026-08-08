export * from "./config.ts";
export * from "./types.ts";
export * from "./client/firecracker-api.ts";
export * from "./vm/vm-manager.ts";
export * from "./vm/vm-pool.ts";
export * from "./image/rootfs-builder.ts";
export * from "./network/tap-manager.ts";

import { VmManager } from "./vm/vm-manager.ts";
export const vmManager = new VmManager();
