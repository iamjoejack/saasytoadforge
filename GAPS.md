# Gap audit (2026-06-15)

Findings from a three-lens review (security/multi-tenancy, correctness/bugs,
feature-completeness) with disposition. "Fixed" = closed + tested this pass.

## Fixed this pass
- **P0 agent-service had no auth/authz; workspaces had no owner** -> signed per-user
  tokens (HMAC, `packages/shared/src/token.ts`), an onRequest auth hook + WS `?token=`
  check, `Workspace.owner`, ownership enforced in every route (cross-tenant access now
  404s). Web mints tokens at `/api/agent-token`; the client attaches them. Tested
  (`workspace/api.test.ts` cross-tenant + 401 cases, all e2e).
- **CORS reflected any origin** -> pinned to `ALLOWED_ORIGINS` (default `localhost:3000`).
- **WebSockets had no origin/auth** -> validated via `?token=`.
- **Session cookie missing `secure`** -> set in production.
- **Spend cap keyed by workspace (bypassable via new workspaces)** -> keyed by user id.
- **Concurrent tasks corrupted session/approval state** -> a `running` guard rejects a
  second task; the loop is per-run.
- **ApprovalGate leaked pending promises on disconnect** -> `rejectAll()` on socket close.
- **Shell route: unhandled `openShell` throw** -> try/catch + clean close.
- **Sandboxes never destroyed (leak) + no workspace delete** -> `DELETE /workspaces/:id`
  wired to `destroy`, plus a delete button on the workspaces list.
- **File tree never refreshed after agent edits** -> a `fileVersion` counter re-fetches
  the root listing on each `edit`.
- **EditorPane debounced-save timers never cleared on unmount** -> cleanup effect.

## Known gaps — honestly documented, not yet closed
These need real infra/secrets or are deliberately deferred. Do not claim them as done.
- **E2B egress is a no-op.** `e2b-provider.setEgressAllowlist` does nothing; default-deny
  egress is enforced only by the *mock*. Real enforcement needs an E2B template/firewall
  network policy. SECURITY.md 6.2 is downgraded accordingly.
- **Spend is a fixed pre-charge estimate**, never reconciled to real token usage from the
  model response. A long run can overrun the cap within one task.
- **Supabase is schema-only.** Auth (`DevAuthProvider`), sessions, artifacts, and the spend
  ledger are in-process; they reset on restart. `@supabase/supabase-js` is not wired.
- **Stripe has no real provider.** `createBillingProvider` returns the mock even with a key;
  `MockBillingProvider` never charges. Real Checkout is a drop-in.
- **"Fusion" deep reasoning is routing only** — it swaps the model id and inflates the cost
  estimate; there is no panel/judge multi-model orchestration.
- **Screenshots default to the simulated SVG** (`MockBrowserTool`); the real
  `PlaywrightBrowserTool` exists but is not the wired default.
- **No rate limiting** on the agent-service (workspace creation, exec, shell).
- **Sessions/artifacts grow unbounded** in memory (no GC/cap); base64 screenshots are kept.
- **No file CRUD in the tree** (create/delete/rename) and **no session-history browser** UI.
- **Daytona / WebContainers providers** are not implemented (mock fallback).
- **Lighthouse perf gate** runs at deploy against the real editor route.
