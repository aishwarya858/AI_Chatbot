"use client";

import { NewChatIcon, SidebarIcon, TrashIcon } from "@/components/icons";
import type { Conversation } from "@/lib/storage";

interface SidebarProps {
  open: boolean;
  conversations: Conversation[];
  activeId: string | null;
  loadingId: string | null;
  onClose: () => void;
  onNewChat: () => void;
  onOpenChat: (id: string) => void;
  onDeleteChat: (id: string) => void;
}

/** Groups chats into Today / Yesterday / Previous 7 days / Older, newest first. */
function groupByDate(conversations: Conversation[]) {
  const startOfToday = new Date().setHours(0, 0, 0, 0);
  const day = 86_400_000;
  const groups: { label: string; items: Conversation[] }[] = [
    { label: "Today", items: [] },
    { label: "Yesterday", items: [] },
    { label: "Previous 7 days", items: [] },
    { label: "Older", items: [] },
  ];
  for (const c of [...conversations].sort((a, b) => b.updatedAt - a.updatedAt)) {
    if (c.updatedAt >= startOfToday) groups[0].items.push(c);
    else if (c.updatedAt >= startOfToday - day) groups[1].items.push(c);
    else if (c.updatedAt >= startOfToday - 7 * day) groups[2].items.push(c);
    else groups[3].items.push(c);
  }
  return groups.filter((g) => g.items.length);
}

export default function Sidebar({
  open,
  conversations,
  activeId,
  loadingId,
  onClose,
  onNewChat,
  onOpenChat,
  onDeleteChat,
}: SidebarProps) {
  const groups = groupByDate(conversations);

  return (
    <>
      {/* Mobile backdrop */}
      {open && <div className="fixed inset-0 z-30 bg-black/30 md:hidden" onClick={onClose} aria-hidden />}

      <aside
        aria-label="Chat history"
        className={`fixed inset-y-0 left-0 z-40 flex w-[272px] flex-col bg-zinc-50 transition-transform duration-200 md:static md:z-auto md:border-r md:border-zinc-200/70 dark:bg-zinc-900 md:dark:border-zinc-800 ${
          open ? "translate-x-0" : "-translate-x-full md:hidden"
        }`}
      >
        <div className="flex h-14 items-center justify-between px-3">
          <div className="flex items-center gap-2 pl-1">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-900 text-[13px] font-semibold text-white dark:bg-white dark:text-zinc-900">
              N
            </span>
            <span className="font-semibold tracking-tight">Nova</span>
          </div>
          <button type="button" onClick={onClose} className="icon-btn" aria-label="Close sidebar" title="Close sidebar">
            <SidebarIcon />
          </button>
        </div>

        <div className="px-3 pb-2">
          <button
            type="button"
            onClick={onNewChat}
            className="flex w-full items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium shadow-xs transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700"
          >
            <NewChatIcon width={16} height={16} />
            New chat
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 pb-4">
          {groups.length === 0 ? (
            <p className="px-3 py-6 text-sm text-zinc-500 dark:text-zinc-400">No chats yet. Your conversations will appear here.</p>
          ) : (
            groups.map((g) => (
              <div key={g.label} className="mt-4 first:mt-2">
                <h3 className="px-3 pb-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">{g.label}</h3>
                <ul>
                  {g.items.map((c) => {
                    const isActive = c.id === activeId;
                    return (
                      <li key={c.id} className="group relative">
                        <button
                          type="button"
                          onClick={() => onOpenChat(c.id)}
                          title={c.title}
                          aria-current={isActive ? "page" : undefined}
                          className={`flex w-full items-center gap-2 rounded-lg py-2 pl-3 pr-9 text-left text-sm transition ${
                            isActive
                              ? "bg-zinc-200/80 font-medium text-zinc-900 dark:bg-zinc-800 dark:text-white"
                              : "text-zinc-700 hover:bg-zinc-200/50 dark:text-zinc-300 dark:hover:bg-zinc-800/60"
                          }`}
                        >
                          {c.id === loadingId && <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-zinc-500" />}
                          <span className="truncate">{c.title}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteChat(c.id)}
                          aria-label={`Delete chat: ${c.title}`}
                          title="Delete chat"
                          className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-zinc-400 transition hover:bg-zinc-300/60 hover:text-red-600 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100 dark:hover:bg-zinc-700"
                        >
                          <TrashIcon width={15} height={15} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </nav>

        <p className="px-4 py-3 text-xs text-zinc-400 dark:text-zinc-500">Chats are saved in this browser.</p>
      </aside>
    </>
  );
}
