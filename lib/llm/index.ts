import { anthropicProvider } from "./anthropic";
import { geminiProvider } from "./gemini";
import type { ChatProvider } from "./provider";

/**
 * Picks the AI provider.
 * - AI_PROVIDER=gemini | anthropic selects one explicitly.
 * - Otherwise Gemini is used when GEMINI_API_KEY is set, falling back to Claude when only ANTHROPIC_API_KEY is set.
 */
export function getProvider(): ChatProvider | string {
  const choice = process.env.AI_PROVIDER?.trim().toLowerCase();
  if (choice === "gemini") return geminiProvider;
  if (choice === "anthropic" || choice === "claude") return anthropicProvider;
  if (choice) return `Unknown AI_PROVIDER "${choice}". Use "gemini" or "anthropic".`;

  if (process.env.GEMINI_API_KEY) return geminiProvider;
  if (process.env.ANTHROPIC_API_KEY) return anthropicProvider;
  return geminiProvider; // default; the route reports the missing key
}
