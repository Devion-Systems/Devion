import { Hono } from "hono";
import {
  AiGatewayDisabledError,
  aiTextRequestSchema,
  generateAiText,
  streamAiText,
} from "../features/ai-gateway/index.js";
import { requireAuthenticatedUser } from "../middleware/auth.js";
import type { AppEnv } from "../types/env.js";

const aiGatewayRoutes = new Hono<AppEnv>();

aiGatewayRoutes.use("/*", requireAuthenticatedUser);

function requireGatewayKey(request: Request): Response | undefined {
  const expectedKey = process.env.AI_GATEWAY_API_KEY;
  if (!expectedKey) {
    return Response.json(
      { error: "AI gateway is disabled: AI_GATEWAY_API_KEY is not configured" },
      { status: 503 },
    );
  }

  if (request.headers.get("x-devion-ai-key") !== expectedKey) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}

aiGatewayRoutes.post("/generate", async (c) => {
  const unauthorized = requireGatewayKey(c.req.raw);
  if (unauthorized) return unauthorized;

  const payload = aiTextRequestSchema.safeParse(await c.req.json());
  if (!payload.success) {
    return c.json({ error: "Invalid AI request", issues: payload.error.flatten() }, 400);
  }

  try {
    const result = await generateAiText(payload.data);
    c.get("logger").info(
      { provider: payload.data.provider, model: payload.data.model },
      "AI text generated",
    );
    return c.json(result);
  } catch (error) {
    if (error instanceof AiGatewayDisabledError) {
      return c.json({ error: error.message }, 503);
    }
    throw error;
  }
});

aiGatewayRoutes.post("/stream", async (c) => {
  const unauthorized = requireGatewayKey(c.req.raw);
  if (unauthorized) return unauthorized;

  const payload = aiTextRequestSchema.safeParse(await c.req.json());
  if (!payload.success) {
    return c.json({ error: "Invalid AI request", issues: payload.error.flatten() }, 400);
  }

  try {
    const result = await streamAiText(payload.data);
    c.get("logger").info(
      { provider: payload.data.provider, model: payload.data.model },
      "AI text stream started",
    );
    return result.toTextStreamResponse();
  } catch (error) {
    if (error instanceof AiGatewayDisabledError) {
      return c.json({ error: error.message }, 503);
    }
    throw error;
  }
});

export { aiGatewayRoutes };
