import { z } from "zod";

export const registryEnvSchema = z.object({
  DOCKER_REGISTRY_URL: z.string().url().default("http://localhost:5000"),
  DOCKER_REGISTRY_USERNAME: z.string().optional(),
  DOCKER_REGISTRY_PASSWORD: z.string().optional(),
});

export type RegistryEnv = z.infer<typeof registryEnvSchema>;
