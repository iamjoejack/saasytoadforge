# Forge Build Progress

CURRENT TASK: Phase 4 COMPLETE on mocks (gate verified). NEXT: Phase 5 - Supabase auth + RLS, workspace/session/artifact persistence, Stripe scaffold, README, Vercel + Railway/Fly deploy configs, prod smoke test. STOPS for human approval before paid/prod deploy + live Stripe (needs SUPABASE_* + STRIPE_*).

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
- [x] egress allowlist enforcement + test (lib/egress.ts, default-deny per sandbox via WorkspaceManager; curl/wget blocked unless allowlisted)
- [x] spend ledger + caps + test (lib/spend.ts; enforced before each model call in the agent WS handler)
- [x] side-effect approval queue (ApprovalGate + write-approval; pause/resume verified)
- [x] token/$ dashboard (per-session cost in the Agent panel + /settings policy screen via /config + /spend)
- [x] structured logging, no secrets (lib/logger.ts + redaction test; wired into agent runs)
- [x] Fusion-gated deep-reasoning action (resolveDeepModel + per-request cap; UI "deep reasoning" toggle; degrades to frontier)
- [x] GATE: egress-block test PASS, spend-cap test PASS, approval pause/resume PASS, per-session cost dashboard PASS. 68 unit/integration tests + 5 Playwright flows.

## Phase 5 - Auth, persistence, billing, ship  (scaffold ready; STOP boundary per 2.4)
- [x] Auth flow works (dev provider): AuthProvider interface + DevAuthProvider (scrypt + cookie sessions) + sign-in/up page + middleware gate + sign-out. Supabase Auth is the drop-in. Verified via Playwright. (Supabase RLS schema written; real wiring pending SUPABASE_*.)
- [x] session/artifact persistence (in-memory): InMemorySessionStore records each agent session + its artifacts; GET /workspaces/:id/sessions; verified. Supabase (schema + RLS ready) is the drop-in. Spend ledger in-process.
- [x] Stripe subscription scaffold: BillingProvider interface + MockBillingProvider + flat PLANS (Solo/Pro/Agency, AI included never metered) + /billing/plans + /billing/checkout (mock, no charge) + /pricing page. Real StripeBillingProvider is the drop-in (pending STRIPE_*). No live charges.
- [x] README (setup, env, architecture, security, deploy)
- [x] Vercel + Fly/Railway deploy configs (vercel.json, Dockerfile, .dockerignore, fly.toml)
- [x] production smoke test (e2e/smoke.spec.ts: pricing -> sign up -> workspace -> task green; override baseURL to target a deployment)
- [ ] Lighthouse perf >= 90 on the editor route - run at deploy against the real URL (editor is gated + lazy-loads Monaco)
- [ ] GATE: STOP per 2.4 - real SUPABASE_* + STRIPE_* secrets, real Supabase auth/persistence wiring, live Stripe, and the first paid/prod deploy need explicit approval. Everything not crossing that line is done.
