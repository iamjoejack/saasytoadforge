# SaaSyToad Forge

An agent-first, web-based coding workspace. Describe a coding task in chat; an AI agent
plans it, edits files inside an isolated sandbox, runs and verifies the result, and returns
reviewable artifacts (plan, diff, test output, screenshot).

> Status: Phase 0 (foundation). See [PROGRESS.md](./PROGRESS.md) for the live build state,
> [DECISIONS.md](./DECISIONS.md) for choices/assumptions, and [ARCHITECTURE.md](./ARCHITECTURE.md)
> for the system shape and security model.

## Stack
- **Web**: Next.js 15 (App Router), TypeScript (strict), Tailwind v4 -> Vercel
- **Agent service**: Fastify (websockets + agent loop + sandbox orchestration) -> Railway/Fly
- **Shared**: zod env schema, `SandboxProvider` interface, domain types
- **Sandbox**: E2B (microVM) default, behind a clean `SandboxProvider` (Daytona/WebContainers swappable)
- **Models**: OpenRouter via a config-driven `ModelRouter` (fast / frontier / Fusion deep-reasoning)
- **Persistence**: Supabase Postgres + Auth + RLS

## Prerequisites
- Node >= 20 (tested on 24)
- pnpm 9 (`npm i -g pnpm@9.15.0` or `corepack pnpm`)

## Setup
```bash
pnpm install
cp .env.example apps/web/.env.local      # fill in as needed (optional in dev; mocks otherwise)
cp .env.example apps/agent-service/.env
```

## Develop
```bash
pnpm dev          # runs all workspaces' dev servers in parallel
# or individually:
pnpm --filter @forge/web dev
pnpm --filter @forge/agent-service dev
```

## Verify
```bash
pnpm lint         # eslint (flat config), whole repo
pnpm test         # vitest workspace (shared + agent-service + web units)
pnpm build        # topological build (shared/agent-service typecheck + next build)
pnpm test:e2e     # Playwright (from Phase 1; run `pnpm exec playwright install` first)
```

## Environment
See [.env.example](./.env.example). Secrets are optional at boot - missing ones degrade to
mock providers so the app never hard-blocks in development. Required for live features:
`OPENROUTER_API_KEY`, `E2B_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.

## Security model
Untrusted/agent-generated code runs only inside the sandbox (microVM/gVisor), never on the
host. Egress is default-deny per sandbox. Irreversible side effects require explicit user
approval. Secrets are env-only and never logged. Per-user and global spend caps are enforced
before each model call. Details in [ARCHITECTURE.md](./ARCHITECTURE.md).
