# Forge Build Progress

CURRENT TASK: Phase 3 COMPLETE on mocks (gate verified via Playwright; SECURITY.md review PASS). NEXT: Phase 4 - egress allowlist enforcement + test, spend ledger + caps + test, side-effect approval queue, token/$ dashboard, structured logging, Fusion-gated deep reasoning. (Real agent/sandbox pending OPENROUTER_API_KEY + E2B_API_KEY.)

Legend: [ ] todo · [~] in progress · [x] done (passed its gate)

## Phase 0 - Foundation
- [x] monorepo + tooling (pnpm workspaces: apps/web, apps/agent-service, packages/shared)
- [x] TypeScript strict base config
- [x] ESLint (flat) + Prettier
- [x] Vitest (workspace) + Playwright config
- [x] zod-validated env schema (packages/shared/src/env.ts)
- [x] SandboxProvider interface defined (packages/shared/src/sandbox.ts)
- [x] GitHub Actions CI (lint + test + build)
- [x] state files (PROGRESS / DECISIONS / ARCHITECTURE)
- [x] GATE: `pnpm install && pnpm lint && pnpm test && pnpm build` all green (lint 0 problems, 9/9 tests, next build 4/4 static). Landing render verified: page serves + Tailwind compiled brass token c8a24a.
- [x] commit Phase 0

## Phase 1 - IDE shell + live sandbox
- [x] mock SandboxProvider (in-memory FS + streaming shell) + factory (apps/agent-service/src/sandbox) - 10 tests
- [x] agent-service workspace API: REST files/exec + WS shell + path-traversal guard - 13 tests
- [x] 3-pane IDE layout (file tree | Monaco | terminal | agent panel) - IdeShell
- [x] Monaco editor with tabs (lazy-loaded, vs-dark)
- [x] file tree (lazy dir expansion)
- [x] xterm terminal wired to /workspaces/:id/shell websocket
- [x] debounced file sync (600ms; sandbox FS is source of truth)
- [ ] E2B SandboxProvider impl behind the interface (HUMAN-INPUT: E2B_API_KEY; mock fallback wired) - deferred, not gating
- [x] GATE: open workspace -> sandbox boots -> edit persists -> shell streams back. Proven: vitest API round-trip + WS shell + Playwright UI e2e (Monaco edit persists to sandbox, terminal command streams). Screenshot verified.

## Phase 2 - Single-agent loop  (scaffolded on mocks per user choice)
- [x] LlmClient interface + MockLlmClient + OpenRouterLlmClient (streaming, key-gated) + ModelRouter
- [x] Planner: MockPlanner (scripted) + LlmPlanner (parses structured actions; tested via fake LLM) + factory
- [x] plan -> edit -> run loop (Agent) with unified-diff artifacts + ApprovalGate
- [x] write-approval toggle (server side: requireWriteApproval pauses each write)
- [x] agent websocket endpoint /workspaces/:id/agent (AgentCommand in, AgentEvent out)
- [x] mock sandbox simulated test runner (node --test) - labeled simulation; real run needs E2B
- [x] backend tests: diff, agent loop (+approval pause/reject), planner, llm, agent-WS (37 agent-service tests)
- [x] chat UI + artifact viewer (message bubbles, plan steps, diff, terminal) in the Agent panel (agent-store + artifacts.tsx)
- [x] write-approval toggle in the UI + ApprovalCard (approve/reject)
- [x] Playwright flows (on mock): agent loop artifacts + write-approval round-trip
- [x] GATE: "add an endpoint returning current time + a test" -> plan, edits (diff artifacts), green test run (terminal artifact), all streamed to the Agent panel. Verified via Playwright + screenshots. (Execution simulated by mock; real run is a drop-in with E2B_API_KEY.)

## Phase 3 - Subagents + tools + artifacts UI  (scaffolded on mocks)
- [x] Orchestrator + Coder + Verifier + Browser subagents (roles on plan steps + event attribution)
- [x] scoped MCP-style ToolSet (filesystem + terminal bound to sandbox, browser) - mission section 10
- [x] artifact viewer: subagent badges, screenshot view, accept/reject on diffs (reject reverts in sandbox)
- [x] screenshot capture: PlaywrightBrowserTool (real PNG of produced HTML) + MockBrowserTool (SVG preview, default for scaffold)
- [x] GATE: multi-file UI task -> orchestrator decomposes -> bundle (plan, multi-file diff, test output, screenshot). Verified via Playwright + screenshot. SECURITY.md review of 6.1-6.3 = PASS.

## Phase 4 - Safety, cost, observability
- [ ] egress allowlist enforcement + test
- [ ] spend ledger + caps + test
- [ ] side-effect approval queue
- [ ] token/$ dashboard
- [ ] structured logging (no secrets)
- [ ] Fusion-gated deep-reasoning action
- [ ] GATE: egress-block test, spend-cap test, approval pause/resume, per-session cost dashboard

## Phase 5 - Auth, persistence, billing, ship
- [ ] Supabase Auth + RLS
- [ ] workspace/session/artifact persistence
- [ ] Stripe subscription scaffold (no live charge without approval)
- [ ] README (setup, env, architecture, security model)
- [ ] Vercel + Railway/Fly deploy configs
- [ ] production smoke test
- [ ] GATE: full DoD; deploy succeeds; smoke green. STOP for human approval before paid/prod deploy + live Stripe.
