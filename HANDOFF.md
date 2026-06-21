# SaaSyToad Forge — Agent Handoff Document
> Generated: 2026-06-15 | Conversation: b6530ae8-89a9-4ec9-93a6-2a53bbbe9af7

---

## 🗂 Project Overview

**SaaSyToad Forge** is a premium, agent-first visual-code development workbench — think Google Antigravity but SaaSy-Toad branded with a Steampunk aesthetic. It lives in the monorepo at:

```
c:\Users\khoal\.gemini\antigravity\scratch\saasytoadforge\
```

It is a **separate product** from the main SaaSyToad marketing/CRM site (at `c:\Users\khoal\.gemini\antigravity\scratch\saasytoad\`).

### Monorepo Structure
```
saasytoadforge/
├── apps/
│   ├── agent-service/        ← Fastify backend (WebSocket agent loop, billing, sandboxes)
│   │   └── src/
│   │       ├── agent/        ← Agent, ApprovalGate, QuestionGate, LLM client, tools, planner
│   │       ├── billing/      ← Stripe + mock billing, plans
│   │       ├── lib/          ← spend.ts (ledger+caps), logger, paths
│   │       ├── persistence/  ← InMemorySessionStore, SupabaseSessionStore
│   │       ├── sandbox/      ← E2B + mock sandbox providers
│   │       ├── workspace/    ← WorkspaceManager
│   │       └── server.ts     ← Fastify entry with all REST + WS routes
│   └── web/                  ← Next.js 15 frontend
│       └── src/
│           ├── app/          ← Pages: /, /workspaces, /workspaces/[id], /settings, /pricing, /admin, /signin
│           ├── components/ide/ ← IdeShell, AgentPanel, EditorPane, FileTree, TerminalPane, artifacts.tsx, BlocksPalette
│           └── lib/          ← agent-store.ts (Zustand), forge-client.ts, store.ts (IDE state)
└── packages/shared/          ← Shared types: AgentEvent, AgentCommand, ConfigSummary, etc.
```

---

## ✅ What Has Been Completed (This Session)

### 1. Visual Settings Page Redesign (Antigravity-Style)
Redesigned `apps/web/src/app/settings/page.tsx` as a beautiful split-pane sidebar navigation settings layout matching Google's Antigravity:
- **Profile & Plan**: Displays logged-in user email and active plan. If the email is `joejackson80@gmail.com`, it displays a gold `👑 Company Owner (Unlimited)` badge and bypasses user spending caps. Otherwise, it displays a `💼 Pro Builder ($29/mo)` badge.
- **Sign Out Routing**: Sign Out button posts to `/api/auth/signout` and redirects to `/signin`.
- **API Keys & Model Overrides**: Users can enter custom Anthropic and Google API keys (persisted locally under `forge:custom_keys`) and configure a custom OpenRouter model ID.
- **Spend & Cap Controls**: Switch between fixed cap and unlimited top-up mode, soft limits inputs, confirmation modal, and visual internal caps display.
- **Appearance & UX**: Supports switching between Slate and Steampunk themes (using the global `useIde` store) and toggling browser desktop push notifications.
- **Danger Zone**: Action button to "Delete All Workspaces", which deletes all workspaces registered under the active session.

### 2. Autocomplete, Mentions & Action Commands
Upgraded the chat textarea box in `AgentPanel.tsx` with dynamic autocompletes:
- **`@` Mentions**: Triggers autocomplete dropdown list of workspace files. Mentions add a file pill badge above the text input (`📄 filename ✕`).
- **`+` Attach Button**: Triggers the same workspace files search suggest dropdown.
- **`/` Action Commands**: Triggers a suggest list of commands:
  - `/goal` - Plan and run task thoroughly
  - `/explain` - Explain code inside a file (triggers `@` suggest)
  - `/write-tests` - Write unit tests for code (triggers `@` suggest)
  - `/clear` - Local chat history clear
  - `/stop` - Stop/cancel active execution
  - `/help` - Prints local menu options
- **Pre-attaching File Contexts**: Submitting a task reads the contents of all attached files on the server and prefixes them into the WebSocket prompt context seamlessly.

### 3. Conversation Window UX Upgrades
Upgraded the message bubbles and execution flows in `artifacts.tsx` and `agent-store.ts`:
- **Blinking Streaming Cursor**: Displays an active blinking cursor block (`|`) at the end of the assistant message while the agent is running and streaming.
- **Markdown Rendering**: Upgraded `renderMarkdown` to parse consecutive code blocks into a single `<pre>` tag containing copy button and language labels, along with bullet lists and document links.
- **Credit Spend Bar**: Relocated the `SpendMeter` progress bar to be positioned directly above the input box.
- **Notifications Alert**: Hooks into WebSocket `done` and `error` events to display browser desktop push notifications when background tasks complete.

### 4. Pricing / Billing Backend
- `apps/agent-service/src/billing/billing.ts` — Plans updated to **Pro Builder ($29/mo)** + **Cap Extension ($10)**.
- `apps/agent-service/src/billing/stripe-billing.ts` — Removed obsolete Solo/Agency tiers.

---

## 🏃 How to Run Locally

```powershell
# From monorepo root
cd c:\Users\khoal\.gemini\antigravity\scratch\saasytoadforge

# Install dependencies
pnpm install

# Start both services (agent-service on :8787, web on :3000)
pnpm dev

# Run all tests
pnpm test

# Build production bundle
pnpm build
```

---

## 📎 Key Artifact References

| Artifact | Path |
|---|---|
| Implementation Plan | `C:\Users\khoal\.gemini\antigravity-ide\brain\b6530ae8-89a9-4ec9-93a6-2a53bbbe9af7\implementation_plan.md` |
| Task Checklist | `C:\Users\khoal\.gemini\antigravity-ide\brain\b6530ae8-89a9-4ec9-93a6-2a53bbbe9af7\task.md` |
| Walkthrough | `C:\Users\khoal\.gemini\antigravity-ide\brain\b6530ae8-89a9-4ec9-93a6-2a53bbbe9af7\walkthrough.md` |
