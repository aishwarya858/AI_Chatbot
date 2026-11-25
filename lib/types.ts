/** A chat message as stored in the browser and sent to /api/chat. */
export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

/**
 * Events streamed from /api/chat as newline-delimited JSON (one object per line).
 * - text:   a chunk of the assistant's reply
 * - notice: non-fatal information (e.g. the reply was cut off at the length limit)
 * - error:  the request failed; `message` is safe to show to the user
 * - done:   the reply finished successfully
 */
export type StreamEvent =
  | { type: "text"; text: string }
  | { type: "notice"; message: string }
  | { type: "error"; message: string }
  | { type: "done" };
