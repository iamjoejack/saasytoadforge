# Decisions & Assumptions

Defaults are chosen so work never blocks. Items needing a real human input are
marked and mirrored with a `// HUMAN-INPUT NEEDED` comment in code.

| Date | Decision | Why | Default chosen | Human-input needed? |
|------|----------|-----|----------------|---------------------|
| 2026-06-14 | Monorepo layout `apps/web`, `apps/agent-service`, `packages/shared` | Mission lists `web`, `agent-service`, `packages/shared`; `apps/` is the conventional home for deployables | `apps/*` + `packages/*` pnpm globs | No |
| 2026-06-14 | pnpm via corepack/global install | `pnpm` not preinstalled; corepack shim blocked by Program Files perms | `npm i -g pnpm@9.15.0` into user prefix | No |
| 2026-06-14 | `shamefully-hoist=true` in .npmrc | Flat node_modules avoids Next/Tailwind resolution friction in a pnpm monorepo | hoisted node_modules | No (revisit if it masks an undeclared dep) |
| 2026-06-14 | Next.js 15 (not 16) for Forge | Greenfield repo; 15 is the well-understood stable line. (The Next 16 caveat in this scratch dir applies to the *thebestcrm* repo, not Forge.) | `next@^15.1.3`, React 19 | No |
| 2026-06-14 | Tailwind v4 (CSS-first, `@tailwindcss/postcss`) | No `tailwind.config` needed; less surface to drift | `@import "tailwindcss"` in globals.css | No |
| 2026-06-14 | Phase 0 `build` = typecheck (`tsc --noEmit`) for shared/agent-service; `next build` for web | No runtime artifacts needed until deploy; sidesteps ESM `.js`-extension friction | base tsconfig `noEmit: true` | No |
| 2026-06-14 | `@forge/shared` exported as source (`./src/index.ts`), consumed via Next `transpilePackages` and `tsx` | Avoids a separate dist build + ESM extension rewriting | source export | No |
| 2026-06-14 | agent-service run via `tsx` (dev + start) in Phase 0 | Long-lived service; proper bundle (tsup) deferred to Phase 5 deploy | `tsx src/index.ts` | No |
| 2026-06-14 | agent-service does NOT yet import `@forge/shared` | Reduce Phase 0 coupling; wired when the agent loop needs shared types (Phase 2) | standalone | No |
| 2026-06-14 | Root lint = `eslint .` (flat config); Next build-time lint disabled | Single source of truth for linting | centralized eslint | No |
| 2026-06-14 | Web Phase 0 unit test is a pure function (`cn`), node env | jsdom + RTL added in Phase 1 with real components; keeps the gate robust | node-env vitest | No |
| 2026-06-14 | Playwright browsers NOT installed in Phase 0 | Heavy download; e2e flows start Phase 1 | `pnpm exec playwright install` deferred | No |
| 2026-06-14 | Default model IDs are config defaults (OpenRouter) | Placeholders, env-overridable; not load-bearing until Phase 2 | fast/frontier/deep presets | Yes - confirm exact OpenRouter model slugs at Phase 2 |
| 2026-06-14 | Secret values absent | Building with mock providers per the never-hard-block doctrine | mock SANDBOX_PROVIDER, no live keys | Yes - OPENROUTER_API_KEY, E2B_API_KEY, SUPABASE_*, STRIPE_* before live phases |
| 2026-06-15 | Fastify ws routes nested in a plugin registered AFTER @fastify/websocket | The plugin's onRoute hook must be active before `{ websocket: true }` routes are added, else the upgrade 500s (handler runs as plain HTTP) | nested `app.register(routes(...))` | No |
| 2026-06-15 | Mock shell emulates a PTY line discipline | xterm sends CR on Enter (not LF), needs local echo and CRLF output; bare-LF splitting never ran commands | echo + CR/LF (CRLF=one) + backspace | No |
| 2026-06-15 | Monaco loads via the default CDN loader (@monaco-editor/react) | Avoids a monaco-editor webpack/turbopack bundling step; works in dev/prod with network | CDN loader | Yes - self-host monaco before an air-gapped deploy |
| 2026-06-15 | Visual verification via Playwright headless (Bash), not the preview MCP | The session's preview MCP is bound to a different repo; Playwright is the mission-mandated mechanism anyway | `pnpm exec playwright test` + screenshot artifact | No |
| 2026-06-15 | E2E not in the default CI job | Needs both servers + a browser download; runs as its own step (playwright webServer self-starts them) | separate from lint/test/build | No |

| 2026-06-15 | Phase 5 stops at the deploy/secret boundary | Mission 2.4: real secrets + irreversible prod deploy require human approval | scaffold (schema, deploy configs, README) built; no deploy, no live Stripe, no real auth wiring | Yes - SUPABASE_* + STRIPE_* and prod-deploy approval |
| 2026-06-15 | Auth built directly on Supabase (no throwaway local auth) | Cleaner than building local cookie-auth then replacing it; persistence is in-memory until keys arrive | Supabase Auth + RLS (schema ready) | Yes - SUPABASE_* |

## Open human inputs (surface at each phase boundary)
- OPENROUTER_API_KEY - needed for real agent calls (Phase 2). Mocked until then.
- E2B_API_KEY - needed for real sandboxes (Phase 1). Mock provider until then.
- SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY - persistence + auth (Phase 5).
- STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET - billing scaffold (Phase 5). No live charges without explicit approval.
- Confirm exact OpenRouter model slugs for fast/frontier tiers.
