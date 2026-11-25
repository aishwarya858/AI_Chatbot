import type { ChatMessage } from "@/lib/types";

/** A message as shown in the UI (may carry an error or notice from a failed/stopped reply). */
export interface UIMessage extends ChatMessage {
  id: string;
  error?: string;
  notice?: string;
}

export interface Conversation {
  id: string;
  title: string;
  messages: UIMessage[];
  updatedAt: number;
}

const STORAGE_KEY = "nova.conversations.v1";

/** Loads saved chats from the browser. Returns [] if nothing is saved or storage is unavailable. */
export function loadConversations(): Conversation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data
      .filter(
        (c): c is Conversation =>
          c && typeof c.id === "string" && typeof c.title === "string" && Array.isArray(c.messages),
      )
      .map((c) => ({ ...c, messages: dropFailedReplies(c.messages) }));
  } catch {
    return [];
  }
}

/**
 * Old error messages (e.g. from a provider that has since been fixed) shouldn't haunt saved chats,
 * so failed replies are removed on load. The user's question stays, and the next message
 * sends it again along with the rest of the conversation.
 */
function dropFailedReplies(messages: UIMessage[]): UIMessage[] {
  return messages
    .filter((m) => !(m.role === "assistant" && m.error && !m.content))
    .map((m) => (m.error ? { ...m, error: undefined } : m));
}

/** Saves chats to the browser. Fails silently (e.g. private mode or storage full). */
export function saveConversations(conversations: Conversation[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
  } catch {
    // Storage unavailable or full; chats still work for this session.
  }
}

/** Creates an empty chat titled after its first message. */
export function createConversation(firstMessage: string): Conversation {
  return { id: crypto.randomUUID(), title: makeTitle(firstMessage), messages: [], updatedAt: Date.now() };
}

/** Builds a short chat title from the first user message. */
export function makeTitle(text: string): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length > 48 ? `${oneLine.slice(0, 48)}…` : oneLine || "New chat";
}
