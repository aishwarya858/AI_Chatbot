# Nova: AI Chatbot

A general-purpose AI chatbot built with **Next.js** (React) and **Tailwind CSS**, using the **Google Gemini API**.

## Features

- Answers questions on any topic using Gemini (`gemini-3.6-flash` by default, with automatic fallback to other models when it is busy)
- Streaming responses: text appears as it is generated
- Conversation memory: the full chat history is sent with each request
- A system prompt that defines the assistant's behavior ([lib/system-prompt.js](lib/system-prompt.js))
- Markdown rendering: tables, lists, links, and syntax-highlighted code blocks with a copy button
- Previous chats are saved in the browser and listed in a sidebar
- Loading indicator, a Stop button, and clear error messages with "Try again"
- Clean, responsive layout with light and dark mode
- The API key stays on the server and is never sent to the browser

## Getting started

```bash
npm install
cp .env.example .env.local   # then put your GEMINI_API_KEY in .env.local
npm run dev
```

Open http://localhost:3000.

### Environment variables

| Variable                 | Required | Description                                                                 |
| ------------------------ | -------- | --------------------------------------------------------------------------- |
| `GEMINI_API_KEY`         | yes      | Google Gemini API key ([get one](https://aistudio.google.com/apikey))       |
| `GEMINI_MODEL`           | no       | Main model (default `gemini-3.6-flash`)                                     |
| `GEMINI_FALLBACK_MODELS` | no       | Models tried in order when the main one is busy (default `gemini-3.5-flash,gemini-3.5-flash-lite`) |

`.env.local` is git-ignored. Put real keys only there, never in `.env.example`. Never prefix a key with `NEXT_PUBLIC_`, because that would expose it to the browser.

## Project structure

```
app/
  api/chat/route.js   Server route: validates input, streams the reply from Gemini
  layout.jsx          Root layout and fonts
  page.jsx            Home page
  globals.css         Tailwind CSS, typography plugin, code highlight theme
components/
  Chat.jsx            Chat screen: history, streaming, loading, errors
  Sidebar.jsx         Previous chats grouped by date
  Message.jsx         A single user or assistant message
  Composer.jsx        Message input with send and stop buttons
  Markdown.jsx        Markdown renderer (react-markdown + remark-gfm + rehype-highlight)
  ChatLoader.jsx      Renders the chat in the browser only (it uses localStorage)
  icons.jsx           Small inline SVG icons
lib/
  gemini.js           Gemini API calls, model fallback, and error messages
  storage.js          Saving and loading chats in the browser
  system-prompt.js    The system prompt
```

## How it works

1. The browser keeps the conversation in React state and POSTs the whole history to `/api/chat`.
2. The route validates the messages and streams a reply from Gemini, passing the system prompt as `systemInstruction`.
3. Text chunks are sent back as newline-delimited JSON events (`text`, `notice`, `error`, `done`).
4. The UI appends each chunk to the assistant message and renders it as Markdown.

API failures (invalid key, rate limits or quota, overloaded models, network errors, safety blocks) are turned into readable messages and shown with a "Try again" button.
