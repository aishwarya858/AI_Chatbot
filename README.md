# Nova: AI Chatbot

A general-purpose AI chatbot built with **Next.js (App Router)**, **React**, **Tailwind CSS**, and **Google Gemini** (with optional support for Anthropic Claude).

## Features

- Answers questions on any topic, powered by Gemini (`gemini-3.6-flash` by default, falling back to other models when it is busy) or Claude
- Streaming responses: text appears as it is generated
- Conversation memory: the full chat history is sent with each request
- A system prompt that defines the assistant's behavior ([lib/system-prompt.ts](lib/system-prompt.ts))
- Markdown rendering: GFM tables, lists, links, and syntax-highlighted code blocks with a copy button
- Loading indicator, a Stop button, inline error messages with Retry
- Responsive layout with light and dark mode
- API keys stay on the server and are never sent to the browser

## Getting started

```bash
npm install
cp .env.example .env.local   # then put your GEMINI_API_KEY in .env.local
npm run dev
```

Open http://localhost:3000.

### Environment variables

| Variable            | Required | Description                                                               |
| ------------------- | -------- | ------------------------------------------------------------------------- |
| `GEMINI_API_KEY`    | yes*     | Google Gemini API key ([get one](https://aistudio.google.com/apikey))     |
| `GEMINI_MODEL`      | no       | Gemini model override (default `gemini-3.6-flash`)                        |
| `GEMINI_FALLBACK_MODELS` | no  | Comma-separated models tried in order when the main one is overloaded (default `gemini-3.5-flash,gemini-3.5-flash-lite`) |
| `ANTHROPIC_API_KEY` | no       | Use Claude instead of Gemini                                              |
| `ANTHROPIC_MODEL`   | no       | Claude model override (default `claude-opus-5-5`)                         |
| `AI_PROVIDER`       | no       | Force `gemini` or `anthropic`; otherwise Gemini is used if its key is set |

\* At least one provider key is required.

`.env.local` is git-ignored. Put real keys only there, never in `.env.example`. Never prefix a key with `NEXT_PUBLIC_`, because that would expose it to the browser.

## Project structure

```
app/
  api/chat/route.ts   Server route: validates input, streams the reply as NDJSON events
  page.tsx            Renders the chat
  globals.css         Tailwind, typography plugin, code highlight theme
components/
  Chat.tsx            Chat UI: history, streaming, loading, errors, retry
  Markdown.tsx        Markdown renderer (react-markdown + remark-gfm + rehype-highlight)
lib/
  llm/gemini.ts       Gemini provider (@google/genai)
  llm/anthropic.ts    Claude provider (@anthropic-ai/sdk)
  llm/index.ts        Chooses the provider from env vars
  system-prompt.ts    The system prompt
  types.ts            Shared message and stream-event types
```

## How it works

1. The browser keeps the conversation in React state and POSTs the whole history to `/api/chat`.
2. The route validates the messages and streams a reply from the selected provider, passing the system prompt (`systemInstruction` for Gemini, `system` for Claude).
3. Text chunks are forwarded as newline-delimited JSON events (`text`, `notice`, `error`, `done`).
4. The UI appends each chunk to the assistant message and renders it as Markdown.

API failures (bad key, rate limits or quota, overload, network errors, safety blocks) are mapped to readable messages and shown inline with a Retry button.
