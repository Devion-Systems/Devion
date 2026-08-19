import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import type { AiProvider } from "./types.js";

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`AI provider is not configured: missing ${name}`);
  }
  return value;
}

/**
 * Resolves a model without accepting provider credentials or arbitrary URLs from
 * an HTTP request. This prevents the gateway from becoming an SSRF or key proxy.
 */
export function resolveLanguageModel(provider: AiProvider, modelId: string): LanguageModel {
  switch (provider) {
    case "openai": {
      const openai = createOpenAI({ apiKey: requiredEnvironment("OPENAI_API_KEY") });
      return openai(modelId);
    }
    case "anthropic": {
      const anthropic = createAnthropic({
        apiKey: requiredEnvironment("ANTHROPIC_API_KEY"),
      });
      return anthropic(modelId);
    }
    case "local": {
      const local = createOpenAI({
        baseURL: requiredEnvironment("LOCAL_AI_BASE_URL"),
        // Ollama and many local servers do not validate a key, while vLLM and
        // LM Studio can be protected with LOCAL_AI_API_KEY.
        apiKey: process.env.LOCAL_AI_API_KEY ?? "local-development-key",
      });
      return local(modelId);
    }
    case "compatible": {
      const compatible = createOpenAI({
        baseURL: requiredEnvironment("AI_COMPATIBLE_BASE_URL"),
        apiKey: requiredEnvironment("AI_COMPATIBLE_API_KEY"),
      });
      return compatible(modelId);
    }
  }
}
