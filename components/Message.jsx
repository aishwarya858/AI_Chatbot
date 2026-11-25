"use client";

import { memo, useState } from "react";
import Markdown from "@/components/Markdown";
import { CheckIcon, CopyIcon, RetryIcon } from "@/components/icons";

function Message({ message, isStreaming, onRetry }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-3xl bg-zinc-100 px-4 py-2.5 text-[15px] leading-relaxed dark:bg-zinc-800">
          {message.content}
        </div>
      </div>
    );
  }

  const pending = !message.content && !message.error;

  return (
    <div className="group">
      {pending ? <Thinking /> : message.content && <Markdown content={message.content} />}

      {message.notice && <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">{message.notice}</p>}

      {message.error && (
        <div className="mt-2 flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
          <span className="flex-1">{message.error}</span>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-red-700 shadow-xs ring-1 ring-red-200 transition hover:bg-red-100 dark:bg-red-900/40 dark:text-red-200 dark:ring-red-800"
            >
              <RetryIcon width={14} height={14} />
              Try again
            </button>
          )}
        </div>
      )}

      {message.content && !isStreaming && <MessageActions text={message.content} />}
    </div>
  );
}

function MessageActions({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable; ignore.
    }
  };

  return (
    <div className="mt-1 flex gap-1 transition md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100">
      <button
        type="button"
        onClick={copy}
        className="icon-btn"
        aria-label="Copy response"
        title={copied ? "Copied" : "Copy"}
      >
        {copied ? <CheckIcon width={16} height={16} /> : <CopyIcon width={16} height={16} />}
      </button>
    </div>
  );
}

function Thinking() {
  return (
    <div className="flex h-7 items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400" role="status">
      <span className="flex gap-1">
        {[0, 160, 320].map((d) => (
          <span
            key={d}
            className="h-1.5 w-1.5 animate-bounce rounded-full bg-current"
            style={{ animationDelay: `${d}ms` }}
          />
        ))}
      </span>
      <span className="sr-only">Nova is thinking</span>
    </div>
  );
}

export default memo(Message);
