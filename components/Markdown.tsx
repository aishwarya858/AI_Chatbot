"use client";

import { memo, useState, type ComponentPropsWithoutRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";

function extractText(node: unknown): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (node && typeof node === "object" && "props" in node) {
    return extractText((node as { props: { children?: unknown } }).props.children);
  }
  return "";
}

function CodeBlock({ children, ...props }: ComponentPropsWithoutRef<"pre">) {
  const [copied, setCopied] = useState(false);
  const code = extractText(children).replace(/\n$/, "");
  const className = (children as { props?: { className?: string } })?.props?.className ?? "";
  const language = /language-(\w+)/.exec(className)?.[1];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard may be unavailable (e.g. insecure context); ignore.
    }
  };

  return (
    <div className="not-prose my-4 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
      <div className="flex items-center justify-between bg-zinc-900 px-4 py-1.5 text-xs text-zinc-400">
        <span className="font-mono">{language ?? "code"}</span>
        <button
          type="button"
          onClick={copy}
          className="rounded-md px-2 py-1 transition hover:bg-zinc-800 hover:text-zinc-100"
        >
          {copied ? "Copied" : "Copy code"}
        </button>
      </div>
      <pre {...props} className="overflow-x-auto p-4 font-mono text-[13px] leading-relaxed text-zinc-100">
        {children}
      </pre>
    </div>
  );
}

function Markdown({ content }: { content: string }) {
  return (
    <div className="prose prose-zinc max-w-none text-[15px] leading-7 dark:prose-invert prose-headings:font-semibold prose-headings:tracking-tight prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-p:my-3 prose-li:my-1 prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline dark:prose-a:text-blue-400 prose-pre:p-0 prose-code:before:content-none prose-code:after:content-none prose-code:rounded-md prose-code:bg-zinc-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:text-[13px] prose-code:font-normal dark:prose-code:bg-zinc-800 prose-table:text-sm prose-th:bg-zinc-50 prose-th:px-3 prose-th:py-2 prose-td:px-3 prose-td:py-2 dark:prose-th:bg-zinc-900">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeHighlight, { detect: true, ignoreMissing: true }]]}
        components={{
          pre: CodeBlock,
          a: ({ ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
          table: ({ ...props }) => (
            <div className="overflow-x-auto">
              <table {...props} />
            </div>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export default memo(Markdown);
