# Forge Build Progress

CURRENT TASK: Phase 0 complete and committed. NEXT: Phase 1 - IDE shell + live sandbox.

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
- [ ] 3-pane IDE layout (file tree | Monaco | terminal | agent panel)
- [ ] Monaco editor with tabs + file CRUD
- [ ] file tree
- [ ] xterm terminal wired to SandboxProvider.openShell
- [ ] E2B SandboxProvider impl behind the interface (+ mock provider)
- [ ] debounced file sync (sandbox FS is source of truth)
- [ ] GATE: open workspace -> sandbox boots -> edit persists -> shell command streams back (integration test)

## Phase 2 - Single-agent loop
- [ ] Agent-Runtime service (OpenRouter streaming)
- [ ] plan -> edit -> run loop
- [ ] chat UI
- [ ] plan + diff + terminal output as artifacts
- [ ] write-approval toggle
- [ ] GATE: "add an endpoint returning current time + a test" -> plan, edits, green test, artifacts (Playwright flow)

## Phase 3 - Subagents + tools + artifacts UI
- [ ] Orchestrator + Coder + Verifier + Browser subagents
- [ ] MCP tool surface (filesystem / terminal / browser, scoped)
- [ ] artifact viewer with accept/reject on diffs
- [ ] Playwright screenshot capture for UI tasks
- [ ] GATE: multi-file UI task -> decomposed -> artifact bundle (plan, multi-file diff, test output, screenshot) + Security-Review of 6.1-6.3

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
