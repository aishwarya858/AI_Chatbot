"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Composer from "@/components/Composer";
import Message from "@/components/Message";
import Sidebar from "@/components/Sidebar";
import { ArrowDownIcon, NewChatIcon, SidebarIcon, SparkIcon } from "@/components/icons";
import { createConversation, loadConversations, saveConversations, type Conversation, type UIMessage } from "@/lib/storage";
import type { ChatMessage, StreamEvent } from "@/lib/types";

const SUGGESTIONS = [
  { title: "Explain a concept", detail: "like quantum computing, simply", prompt: "Explain quantum computing in simple terms" },
  { title: "Write some code", detail: "a Python palindrome checker", prompt: "Write a Python function to check if a string is a palindrome" },
  { title: "Learn about history", detail: "why the Roman Empire fell", prompt: "What caused the fall of the Roman Empire?" },
  { title: "Make a plan", detail: "a 3-day beginner workout", prompt: "Give me a 3-day workout plan for beginners" },
];

const newId = () => crypto.randomUUID();
const isDesktop = () => window.matchMedia("(min-width: 768px)").matches;

export default function Chat() {
  // Saved chats are loaded once from the browser (this component only renders client-side).
  const [conversations, setConversations] = useState<Conversation[]>(loadConversations);
  const [activeId, setActiveId] = useState<string | null>(() => {
    const saved = loadConversations();
    return saved.length ? saved.reduce((a, b) => (a.updatedAt > b.updatedAt ? a : b)).id : null;
  });
  const [input, setInput] = useState("");
  const [loadingId, setLoadingId] = useState<string | null>(null); // chat currently receiving a reply
  const [sidebarOpen, setSidebarOpen] = useState(isDesktop);
  const [atBottom, setAtBottom] = useState(true);

  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isLoading = loadingId !== null;
  const active = conversations.find((c) => c.id === activeId) ?? null;
  const messages = useMemo(() => active?.messages ?? [], [active]);

  // Save chats whenever they change (skipped mid-stream to avoid writing on every chunk).
  useEffect(() => {
    if (!isLoading) saveConversations(conversations);
  }, [conversations, isLoading]);

  const scrollToBottom = useCallback((smooth = true) => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }, []);

  // Follow new content only if the user is already at the bottom (so they can scroll up and read).
  useLayoutEffect(() => {
    if (atBottom) scrollToBottom(false);
  }, [messages, atBottom, scrollToBottom]);

  // Jump to the end when switching chats.
  useLayoutEffect(() => {
    scrollToBottom(false);
  }, [activeId, scrollToBottom]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (el) setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
  };

  /** Updates one chat's messages (by id, so a reply keeps streaming into the right chat). */
  const updateConversation = useCallback((convId: string, update: (msgs: UIMessage[]) => UIMessage[]) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === convId ? { ...c, messages: update(c.messages), updatedAt: Date.now() } : c)),
    );
  }, []);

  /** Sends the conversation (history + new user message) and streams the reply. */
  const runCompletion = useCallback(
    async (convId: string, history: UIMessage[]) => {
      const assistantId = newId();
      updateConversation(convId, () => [...history, { id: assistantId, role: "assistant", content: "" }]);
      setLoadingId(convId);
      setAtBottom(true);

      const patchReply = (patch: (m: UIMessage) => Partial<UIMessage>) =>
        updateConversation(convId, (msgs) => msgs.map((m) => (m.id === assistantId ? { ...m, ...patch(m) } : m)));

      const controller = new AbortController();
      abortRef.current = controller;

      // Conversation memory: send every prior successful turn so the model has full context.
      const payload: ChatMessage[] = history
        .filter((m) => !m.error && m.content.trim())
        .map(({ role, content }) => ({ role, content }));

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: payload }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error ?? `Request failed with status ${res.status}.`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let finished = false;

        const handle = (event: StreamEvent) => {
          switch (event.type) {
            case "text":
              patchReply((m) => ({ content: m.content + event.text }));
              break;
            case "notice":
              patchReply(() => ({ notice: event.message }));
              break;
            case "error":
              finished = true;
              patchReply(() => ({ error: event.message }));
              break;
            case "done":
              finished = true;
              break;
          }
        };

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (line.trim()) handle(JSON.parse(line) as StreamEvent);
          }
        }
        if (buffer.trim()) handle(JSON.parse(buffer) as StreamEvent);

        if (!finished) {
          patchReply(() => ({ error: "The connection closed before the response finished." }));
        }
      } catch (err) {
        if (controller.signal.aborted) {
          // User pressed Stop: keep whatever was generated so far.
          patchReply((m) => (m.content ? { notice: "Stopped." } : { error: "Stopped before any response was generated." }));
        } else {
          const message = err instanceof Error ? err.message : "Network error. Please try again.";
          patchReply(() => ({ error: message === "Failed to fetch" ? "Network error. Is the server running?" : message }));
        }
      } finally {
        setLoadingId(null);
        abortRef.current = null;
        textareaRef.current?.focus();
      }
    },
    [updateConversation],
  );

  const send = (text: string) => {
    const content = text.trim();
    if (!content || isLoading) return;
    setInput("");
    const userMsg: UIMessage = { id: newId(), role: "user", content };

    if (active) {
      void runCompletion(active.id, [...active.messages, userMsg]);
    } else {
      // First message of a new chat: create it, titled after the question.
      const conv = createConversation(content);
      setConversations((prev) => [...prev, conv]);
      setActiveId(conv.id);
      void runCompletion(conv.id, [userMsg]);
    }
  };

  /** Retry: drop the failed assistant reply and re-send the conversation up to it. */
  const retry = () => {
    if (isLoading || !active) return;
    const last = active.messages[active.messages.length - 1];
    if (last?.role !== "assistant") return;
    void runCompletion(active.id, active.messages.slice(0, -1));
  };

  const closeSidebarOnMobile = () => {
    if (!isDesktop()) setSidebarOpen(false);
  };

  const newChat = () => {
    setActiveId(null);
    setInput("");
    closeSidebarOnMobile();
    textareaRef.current?.focus();
  };

  const openChat = (id: string) => {
    setActiveId(id);
    closeSidebarOnMobile();
  };

  const deleteChat = (id: string) => {
    if (!window.confirm("Delete this chat? This can't be undone.")) return;
    if (id === loadingId) abortRef.current?.abort();
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (id === activeId) setActiveId(null);
  };

  return (
    <div className="flex h-dvh bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <Sidebar
        open={sidebarOpen}
        conversations={conversations}
        activeId={activeId}
        loadingId={loadingId}
        onClose={() => setSidebarOpen(false)}
        onNewChat={newChat}
        onOpenChat={openChat}
        onDeleteChat={deleteChat}
      />

      <main className="relative flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="flex h-14 shrink-0 items-center gap-1 px-3">
          {!sidebarOpen && (
            <>
              <button type="button" onClick={() => setSidebarOpen(true)} className="icon-btn" aria-label="Open sidebar" title="Open sidebar">
                <SidebarIcon />
              </button>
              <button type="button" onClick={newChat} className="icon-btn" aria-label="New chat" title="New chat">
                <NewChatIcon />
              </button>
            </>
          )}
          <h1 className="ml-2 truncate text-[15px] font-medium text-zinc-700 dark:text-zinc-300">
            {active?.title ?? "Nova"}
          </h1>
        </header>

        {/* Conversation */}
        <div ref={scrollRef} onScroll={onScroll} className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <EmptyState onPick={send} disabled={isLoading} />
          ) : (
            <div className="mx-auto w-full max-w-3xl space-y-8 px-4 pb-10 pt-4 sm:px-6">
              {messages.map((m, i) => {
                const isLast = i === messages.length - 1;
                return (
                  <Message
                    key={m.id}
                    message={m}
                    isStreaming={isLast && loadingId === activeId}
                    onRetry={isLast && m.error && !isLoading ? retry : undefined}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Jump to latest */}
        {!atBottom && messages.length > 0 && (
          <button
            type="button"
            onClick={() => scrollToBottom()}
            aria-label="Scroll to latest message"
            className="absolute bottom-32 left-1/2 flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-600 shadow-md transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <ArrowDownIcon width={18} height={18} />
          </button>
        )}

        {/* Input */}
        <div className="shrink-0 px-3 pb-3 sm:px-6 sm:pb-4">
          <Composer
            ref={textareaRef}
            value={input}
            onChange={setInput}
            onSubmit={() => send(input)}
            onStop={() => abortRef.current?.abort()}
            isLoading={isLoading}
          />
        </div>
      </main>
    </div>
  );
}

function EmptyState({ onPick, disabled }: { onPick: (prompt: string) => void; disabled: boolean }) {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col items-center justify-center px-4 py-10 sm:px-6">
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-900">
        <SparkIcon width={24} height={24} />
      </div>
      <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">How can I help you today?</h2>
      <p className="mt-2 text-center text-[15px] text-zinc-500 dark:text-zinc-400">
        Ask a question, get an explanation, or draft something new.
      </p>
      <div className="mt-8 grid w-full gap-2.5 sm:grid-cols-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s.title}
            type="button"
            onClick={() => onPick(s.prompt)}
            disabled={disabled}
            className="rounded-2xl border border-zinc-200 px-4 py-3 text-left transition hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
          >
            <span className="block text-sm font-medium">{s.title}</span>
            <span className="block text-sm text-zinc-500 dark:text-zinc-400">{s.detail}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
