"use client";

import dynamic from "next/dynamic";

// Chat reads saved conversations from localStorage, so render it only in the browser.
const Chat = dynamic(() => import("@/components/Chat"), {
  ssr: false,
  loading: () => <div className="h-dvh bg-zinc-50 dark:bg-zinc-950" />,
});

export default function ChatLoader() {
  return <Chat />;
}
