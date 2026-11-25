"use client";

import { forwardRef, useEffect, type FormEvent, type KeyboardEvent } from "react";
import { ArrowUpIcon, StopIcon } from "@/components/icons";

interface ComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  isLoading: boolean;
}

const Composer = forwardRef<HTMLTextAreaElement, ComposerProps>(function Composer(
  { value, onChange, onSubmit, onStop, isLoading },
  ref,
) {
  // Auto-grow the textarea up to a max height.
  useEffect(() => {
    const el = typeof ref === "object" ? ref?.current : null;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 208)}px`;
  }, [value, ref]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      onSubmit();
    }
  };

  const canSend = value.trim().length > 0;

  return (
    <form onSubmit={submit} className="mx-auto w-full max-w-3xl">
      <div className="flex items-end gap-2 rounded-[26px] border border-zinc-200 bg-white p-2 pl-5 shadow-sm transition focus-within:border-zinc-300 focus-within:shadow-md dark:border-zinc-700 dark:bg-zinc-900 dark:focus-within:border-zinc-600">
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Ask anything"
          rows={1}
          autoFocus
          aria-label="Message"
          className="max-h-52 flex-1 resize-none bg-transparent py-2 text-[15px] leading-6 outline-none placeholder:text-zinc-400"
        />
        {isLoading ? (
          <button
            type="button"
            onClick={onStop}
            aria-label="Stop generating"
            title="Stop"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-white transition hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            <StopIcon width={18} height={18} />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!canSend}
            aria-label="Send message"
            title="Send"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-600"
          >
            <ArrowUpIcon width={18} height={18} />
          </button>
        )}
      </div>
      <p className="mt-2 text-center text-xs text-zinc-400 dark:text-zinc-500">
        Nova can make mistakes. Check important info.
      </p>
    </form>
  );
});

export default Composer;
