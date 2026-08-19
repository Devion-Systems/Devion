import { generateText, streamText } from "ai";
import { isFeatureEnabled } from "../feature/index.js";
import { resolveLanguageModel } from "./providers.js";
import type { AiTextRequest } from "./types.js";

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

export async function generateAiText(request: AiTextRequest) {
  await assertAiGatewayEnabled();
  const result = await generateText(toGenerationOptions(request));

  return {
    text: result.text,
    finishReason: result.finishReason,
    usage: result.usage,
  };
}

export async function streamAiText(request: AiTextRequest) {
  await assertAiGatewayEnabled();
  return streamText(toGenerationOptions(request));
}
