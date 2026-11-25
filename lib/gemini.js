import { ApiError, FinishReason, GoogleGenAI } from "@google/genai";
import { SYSTEM_PROMPT } from "@/lib/system-prompt";

const MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";

let client = null;
function getClient() {
  if (!client) client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return client;
}

/** Gemini calls the assistant role "model" and wraps text in `parts`. */
function toContents(messages) {
  return messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
}

const BLOCKED_REASONS = new Set([
  FinishReason.SAFETY,
  FinishReason.RECITATION,
  FinishReason.BLOCKLIST,
  FinishReason.PROHIBITED_CONTENT,
  FinishReason.SPII,
]);

// Models tried in order when the main one is overloaded (comma-separated). Set GEMINI_FALLBACK_MODELS="" to disable.
const FALLBACK_MODELS = (process.env.GEMINI_FALLBACK_MODELS ?? "gemini-3.5-flash,gemini-3.5-flash-lite")
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);
const MODEL_CHAIN = [...new Set([MODEL, ...FALLBACK_MODELS])];

// How long to wait for a model to start answering before moving on to the next one.
const OPEN_TIMEOUT_MS = 20_000;

class OpenTimeoutError extends Error {}

/** Overloaded, rate-limited, unavailable-model, or too-slow errors: worth trying the next model. */
const shouldTryNext = (err) =>
  err instanceof OpenTimeoutError ||
  (err instanceof ApiError && (err.status === 404 || err.status === 429 || err.status >= 500));

/**
 * Opens the stream on the first model that responds, trying MODEL_CHAIN in order.
 * Only the connection is retried — never a half-streamed reply.
 */
async function openStream(messages, signal) {
  let lastError;

  for (const model of MODEL_CHAIN) {
    // Per-attempt controller: aborted by the user's Stop, or by the open timeout.
    const attempt = new AbortController();
    const onUserAbort = () => attempt.abort(signal.reason);
    signal.addEventListener("abort", onUserAbort, { once: true });
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      attempt.abort();
    }, OPEN_TIMEOUT_MS);

    try {
      const stream = await getClient().models.generateContentStream({
        model,
        contents: toContents(messages),
        config: { systemInstruction: SYSTEM_PROMPT, maxOutputTokens: 16000, abortSignal: attempt.signal },
      });
      clearTimeout(timer); // the stream is open; only the user's Stop can abort it now
      return stream;
    } catch (err) {
      clearTimeout(timer);
      signal.removeEventListener("abort", onUserAbort);
      if (signal.aborted) throw err;
      lastError = timedOut ? new OpenTimeoutError(`${model} did not respond in time`) : err;
      if (!shouldTryNext(lastError)) throw lastError;
      const reason = lastError instanceof ApiError ? lastError.status : "timeout";
      console.warn(`[gemini] ${model} unavailable (${reason}); trying next model`);
    }
  }
  throw lastError;
}

async function* streamChat(messages, signal) {
  const stream = await openStream(messages, signal);

  let finishReason;
  for await (const chunk of stream) {
    if (chunk.promptFeedback?.blockReason) {
      yield { type: "error", message: "This request was blocked by Gemini's safety filters. Try rephrasing it." };
      return;
    }
    const text = chunk.text;
    if (text) yield { type: "text", text };
    finishReason = chunk.candidates?.[0]?.finishReason ?? finishReason;
  }

  if (finishReason && BLOCKED_REASONS.has(finishReason)) {
    yield {
      type: "error",
      message: "The response was blocked by Gemini's safety filters. Try rephrasing your request.",
    };
    return;
  }
  if (finishReason === FinishReason.MAX_TOKENS) {
    yield { type: "notice", message: "The response was cut off because it reached the length limit." };
  }
  yield { type: "done" };
}

/** Gemini error messages are often nested JSON; pull out the innermost human-readable "message". */
function readableMessage(raw) {
  const matches = [...raw.matchAll(/\\*"message\\*"\s*:\s*\\*"((?:[^"\\]|\\.)*?)\\*"/g)];
  const last = matches.at(-1)?.[1];
  return (last ?? raw).replace(/\\+n/g, " ").replace(/\\+/g, "").trim();
}

function describeError(err) {
  if (err instanceof OpenTimeoutError) {
    return "Gemini is taking too long to respond right now. Please try again shortly.";
  }
  if (err instanceof ApiError) {
    if (err.message.includes("API_KEY_INVALID")) {
      return "Your Gemini API key is not valid. Check GEMINI_API_KEY in .env.local and restart the server.";
    }
    switch (err.status) {
      case 400:
        return `The request was rejected by Gemini: ${readableMessage(err.message)}`;
      case 401:
      case 403:
        return "Authentication failed. Check that GEMINI_API_KEY in .env.local is valid.";
      case 404:
        return `Model "${MODEL}" was not found. Check GEMINI_MODEL.`;
      case 429:
        return "Rate limit or quota reached. Please wait a moment and try again.";
      default:
        if (err.status >= 500) return "Gemini is temporarily unavailable or overloaded. Please try again shortly.";
        return `Gemini API error (${err.status}). Please try again.`;
    }
  }
  if (err instanceof TypeError) {
    return "Couldn't reach the Gemini API. Check your network connection and try again.";
  }
  return "Something went wrong while generating a response.";
}

export const geminiProvider = {
  name: "gemini",
  apiKeyEnv: "GEMINI_API_KEY",
  streamChat,
  describeError,
};
