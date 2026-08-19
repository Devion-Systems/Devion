export const AI_PROVIDERS = ["openai", "anthropic", "local", "compatible"] as const;

export type AiProvider = (typeof AI_PROVIDERS)[number];

export type AiTextRequest = {
  provider: AiProvider;
  model: string;
  prompt: string;
  system?: string;
  temperature?: number;
  maxOutputTokens?: number;
};
