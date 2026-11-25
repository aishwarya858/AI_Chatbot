import { getProvider } from "@/lib/llm";
import type { ChatMessage, StreamEvent } from "@/lib/types";

// POST route handlers run on the Node.js runtime and are never cached, which is what we need here.

const MAX_MESSAGES = 100;
const MAX_CHARS_PER_MESSAGE = 32_000;

function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

/**
 * Validates the request body and normalizes the conversation.
 * Consecutive messages with the same role (e.g. a user message whose reply failed,
 * followed by a new user message) are merged so roles always alternate.
 */
function normalizeMessages(raw: unknown): ChatMessage[] | string {
  if (!Array.isArray(raw) || raw.length === 0) return "`messages` must be a non-empty array.";
  if (raw.length > MAX_MESSAGES) return `Conversation is too long (max ${MAX_MESSAGES} messages). Start a new chat.`;

  const out: ChatMessage[] = [];
  for (const m of raw as ChatMessage[]) {
    if (!m || (m.role !== "user" && m.role !== "assistant") || typeof m.content !== "string") {
      return "Each message needs a `role` of 'user' or 'assistant' and a string `content`.";
    }
    const content = m.content.trim();
    if (!content) continue;
    if (content.length > MAX_CHARS_PER_MESSAGE) return `A message exceeds ${MAX_CHARS_PER_MESSAGE} characters.`;

    const prev = out[out.length - 1];
    if (prev && prev.role === m.role) {
      prev.content = `${prev.content}\n\n${content}`;
    } else {
      out.push({ role: m.role, content });
    }
  }

  // The conversation must start and end with a user message.
  while (out.length && out[0].role !== "user") out.shift();
  if (!out.length || out[out.length - 1].role !== "user") return "The last message must be from the user.";
  return out;
}

export async function POST(req: Request) {
  const provider = getProvider();
  if (typeof provider === "string") return jsonError(provider, 500);
  const apiKey = process.env[provider.apiKeyEnv]?.trim();
  if (!apiKey || /^(your|paste)-/i.test(apiKey)) {
    return jsonError(`Server is missing ${provider.apiKeyEnv}. Add your real key to .env.local and restart the dev server.`, 500);
  }

  let body: { messages?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonError("Request body must be valid JSON.", 400);
  }

  const messages = normalizeMessages(body.messages);
  if (typeof messages === "string") return jsonError(messages, 400);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: StreamEvent) => controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));

      try {
        for await (const event of provider.streamChat(messages, req.signal)) {
          send(event);
        }
      } catch (err) {
        if (!req.signal.aborted) {
          console.error(`[api/chat:${provider.name}]`, err);
          send({ type: "error", message: provider.describeError(err) });
        }
        // If aborted, the user pressed "Stop" — nothing to report.
      } finally {
        try {
          controller.close();
        } catch {
          // Stream already closed by a client disconnect.
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
