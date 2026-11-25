import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT } from "@/lib/system-prompt";
import type { ChatMessage, StreamEvent } from "@/lib/types";
import type { ChatProvider } from "./provider";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

async function* streamChat(messages: ChatMessage[], signal: AbortSignal): AsyncGenerator<StreamEvent> {
  const stream = getClient().beta.messages.stream(
    {
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      messages,
      // Thinking is adaptive by default on this model; effort controls how much it reasons.
      output_config: { effort: "medium" },
      // If a safety classifier declines, the API retries on an appropriate fallback model.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
    },
    { signal },
  );

  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      yield { type: "text", text: event.delta.text };
    }
  }

  const final = await stream.finalMessage();
  if (final.stop_reason === "refusal") {
    yield { type: "error", message: "The assistant declined to answer this request. Try rephrasing it." };
    return;
  }
  if (final.stop_reason === "max_tokens") {
    yield { type: "notice", message: "The response was cut off because it reached the length limit." };
  }
  yield { type: "done" };
}

function describeError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) {
    return "Authentication failed. Check that ANTHROPIC_API_KEY in .env.local is valid.";
  }
  if (err instanceof Anthropic.PermissionDeniedError) {
    return "This API key doesn't have access to the configured model.";
  }
  if (err instanceof Anthropic.NotFoundError) {
    return `Model "${MODEL}" was not found. Check ANTHROPIC_MODEL.`;
  }
  if (err instanceof Anthropic.RateLimitError) {
    return "Rate limit reached. Please wait a moment and try again.";
  }
  if (err instanceof Anthropic.BadRequestError) {
    // The response body looks like { type: "error", error: { type, message } }; show just the message.
    const body = err.error as { error?: { message?: string } } | undefined;
    return `The request was rejected: ${body?.error?.message ?? err.message}`;
  }
  if (err instanceof Anthropic.InternalServerError) {
    return "The AI service is temporarily unavailable or overloaded. Please try again shortly.";
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return "Couldn't reach the AI service. Check your network connection and try again.";
  }
  if (err instanceof Anthropic.APIError) {
    return `AI service error (${err.status ?? "unknown"}). Please try again.`;
  }
  return "Something went wrong while generating a response.";
}

export const anthropicProvider: ChatProvider = {
  name: "anthropic",
  apiKeyEnv: "ANTHROPIC_API_KEY",
  streamChat,
  describeError,
};
