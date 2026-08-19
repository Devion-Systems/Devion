import { z } from "zod";
import { AI_PROVIDERS } from "./types.js";

export const aiTextRequestSchema = z.object({
  provider: z.enum(AI_PROVIDERS),
  model: z.string().trim().min(1).max(200),
  prompt: z.string().min(1).max(100_000),
  system: z.string().max(50_000).optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxOutputTokens: z.number().int().min(1).max(16_384).optional(),
});
