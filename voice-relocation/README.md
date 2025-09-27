# Voice-Driven Relocation Timeline

Single-page React + TypeScript app that mirrors the Gullie relocation timeline experience with a voice-first assistant powered by OpenAI Realtime. The UI focuses on timeline services, task progression, and live highlights driven by voice tool calls.

## Features
- Service chip selector synced with the assistant via custom browser events and optional localStorage persistence.
- Timeline board grouped by service with card flashes when tasks are updated, completed, or created by the assistant.
- `useVoiceTimeline` hook negotiates a WebRTC session, streams audio/text, and exposes relocation tools (`navigate_view`, `select_services`, `list_tasks`, etc.).
- Floating assistant widget surfaces connection state, status toasts (`assistantUiMessage`), and recent transcript snippets.
- Minimal Express backend issues OpenAI Realtime ephemeral keys from `process.env.OPENAI_API_KEY`.

## Prerequisites
- Node.js 18 or newer (ensures global `fetch`, WebRTC, and Vite compatibility).
- An OpenAI API key with access to the Realtime API.

## Installation
```bash
npm install
```

## Development workflow
1. **Expose your API key**
   ```bash
   export OPENAI_API_KEY="sk-your-key"
   ```
2. **Start the ephemeral-key server**
   ```bash
   npm run server
   ```
   The server listens on `http://localhost:4000` and provides:
   - `POST /api/ephemeral-key` → requests a short-lived Realtime session token.
   - `GET  /api/health` → simple readiness check.
3. **Run the Vite dev server** (in a separate shell):
   ```bash
   npm run dev
   ```
   Vite proxies `/api/*` requests to `http://localhost:4000`, so the frontend can call `/api/ephemeral-key` without additional setup.

Open `http://localhost:5173` to explore the timeline. Use the floating assistant to connect, mute/unmute, and watch the timeline react to simulated tool invocations.

## Event contract
- `categoriesConfirmed` → timeline state updates & persistence.
- `timelineTasksUpdated` → React state refresh + optional assistant highlights.
- `assistantTaskHighlight` → task cards flash when touched by voice tools.
- `assistantUiMessage` → floating assistant displays status toasts (e.g., navigation cues).

## Build
```bash
npm run build
```
Generates production assets in `dist/`.

## Notes
- The voice workflow follows the Gullie `useWebRTCAssistant` shape: session bootstrap, streamed function-call args, `response.function_call_output` reporting, and a follow-up `response.create` to resume the conversation.
- Tailwind CSS powers styling; adjust tokens in `tailwind.config.js` or extend components as needed.
