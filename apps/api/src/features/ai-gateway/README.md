# AI Gateway

Provider-neutral text generation for Devion APIs, built on the Vercel AI SDK.

## Supported providers

| Provider | Configuration | Example model |
| --- | --- | --- |
| OpenAI | `OPENAI_API_KEY` | `gpt-4.1-mini` |
| Anthropic | `ANTHROPIC_API_KEY` | `claude-sonnet-4-5` |
| Local OpenAI-compatible server | `LOCAL_AI_BASE_URL`, optional `LOCAL_AI_API_KEY` | `llama3.2` |
| Hosted OpenAI-compatible server | `AI_COMPATIBLE_BASE_URL`, `AI_COMPATIBLE_API_KEY` | provider specific |

Set `AI_GATEWAY_API_KEY` in every environment. Requests must send the same value in `x-devion-ai-key`. Provider secrets and provider base URLs are server-only; they are intentionally never read from the HTTP request.

The `ai-gateway` system feature is disabled by default. A Better Auth platform administrator must first enable it with `PUT /api/features/ai-gateway` and `{ "enabled": true }`. AI requests additionally require an authenticated Better Auth session.

## HTTP API

`POST /api/ai/generate` returns a completed response. `POST /api/ai/stream` returns a text stream.

```json
{
  "provider": "local",
  "model": "llama3.2",
  "system": "Answer concisely.",
  "prompt": "Summarize this deployment log."
}
```

## License review

The gateway uses only Vercel AI SDK packages (`ai`, `@ai-sdk/openai`, `@ai-sdk/anthropic`), which are Apache-2.0 licensed. Apache-2.0 permits commercial use, subject to its notice requirements. API usage remains subject to each model provider's own commercial terms and pricing.
