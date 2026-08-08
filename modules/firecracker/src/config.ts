import { z } from "zod";
import { parseEnv } from "@repo/core";

export const firecrackerEnvSchema = z.object({
  FIRECRACKER_SOCKET_DIR: z.string().default("/run/devion/firecracker"),
  FIRECRACKER_KERNEL_PATH: z.string().default("/opt/devion/vmlinux"),
  FIRECRACKER_BINARY_PATH: z.string().default("/usr/bin/firecracker"),
  FIRECRACKER_DEFAULT_VCPUS: z.coerce.number().default(1),
  FIRECRACKER_DEFAULT_MEMORY_MIB: z.coerce.number().default(256),
  FIRECRACKER_ROOTFS_DIR: z.string().default("/var/devion/rootfs"),
  FIRECRACKER_TAP_BRIDGE: z.string().default("virbr0"),
  FIRECRACKER_SUBNET: z.string().default("172.20.0.0/16"),
});

export const config = parseEnv(firecrackerEnvSchema);
