# Nova: AI Chatbot

A general-purpose AI chatbot built with **Next.js (App Router)**, **React**, **Tailwind CSS**, and **Google Gemini**.

## Features

- Answers questions on any topic, powered by Gemini (`gemini-3.6-flash` by default, falling back to other models when it is busy)
- Streaming responses: text appears as it is generated
- Conversation memory: the full chat history is sent with each request
- A system prompt that defines the assistant's behavior ([lib/system-prompt.js](lib/system-prompt.js))
- API keys stay on the server and are never sent to the browser

## Getting started

```bash
npm install
cp .env.example .env.local   # then put your GEMINI_API_KEY in .env.local
npm run dev
```

Open http://localhost:3000.
