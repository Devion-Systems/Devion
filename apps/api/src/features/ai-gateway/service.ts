import { generateText, streamText } from "ai";
import { isFeatureEnabled } from "../feature/index.js";
import { resolveLanguageModel } from "./providers.js";
import type { AiTextRequest } from "./types.js";

/** Stable HTTP response contract; avoid leaking provider SDK types into the API. */
export interface AiTextResponse {
  text: string;
  finishReason: string;
  usage: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    reasoningTokens?: number;
    cachedInputTokens?: number;
  };
}

function toGenerationOptions(request: AiTextRequest) {
  return {
    model: resolveLanguageModel(request.provider, request.model),
    prompt: request.prompt,
    system: request.system,
    temperature: request.temperature,
    maxOutputTokens: request.maxOutputTokens,
  };
}

export class AiGatewayDisabledError extends Error {
  constructor() {
    super("AI gateway is disabled (feature flag: ai-gateway = false)");
  }
}

async function assertAiGatewayEnabled() {
  if (!(await isFeatureEnabled("ai-gateway"))) {
    throw new AiGatewayDisabledError();
  }
}

export async function generateAiText(request: AiTextRequest): Promise<AiTextResponse> {
  await assertAiGatewayEnabled();
  const result = await generateText(toGenerationOptions(request));

  return {
    text: result.text,
    finishReason: result.finishReason,
    usage: {
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      totalTokens: result.usage.totalTokens,
      reasoningTokens: result.usage.reasoningTokens,
      cachedInputTokens: result.usage.cachedInputTokens,
    },
  };
}

export async function streamAiText(request: AiTextRequest) {
  await assertAiGatewayEnabled();
  return streamText(toGenerationOptions(request));
}
