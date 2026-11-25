import type { ChatMessage, StreamEvent } from "@/lib/types";

/** Common interface so the API route doesn't care which AI service is used. */
export interface ChatProvider {
  name: "gemini" | "anthropic";
  /** Environment variable that must hold this provider's API key. */
  apiKeyEnv: string;
  /** Streams the reply to a conversation that ends with a user message. */
  streamChat(messages: ChatMessage[], signal: AbortSignal): AsyncGenerator<StreamEvent>;
  /** Turns an SDK error into a message that is safe to show in the UI. */
  describeError(err: unknown): string;
}
