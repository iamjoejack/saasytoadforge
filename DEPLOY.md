# Deploying SaaSyToad Forge

This is a pnpm monorepo with two apps:

- `apps/web` — the Next.js front end. **This is what Vercel deploys.**
- `apps/agent-service` — a long-running Fastify WebSocket server. **Vercel cannot host this**
  (it is not serverless). Run it on Railway, Fly, Render, or a VM, and point the web app at it
  via `NEXT_PUBLIC_AGENT_SERVICE_URL`.

## Vercel: pick ONE root-directory pattern

The deploy fails with `output directory ... was not found` when the Vercel project's
**Root Directory** does not match where the build writes `.next`. Two clean options:

### Option A — Root Directory = `apps/web` (recommended)

In the Vercel project: Settings -> Build and Deployment -> Root Directory -> set to `apps/web`.
Vercel reads `apps/web/vercel.json`, auto-detects Next.js, runs `next build`, and serves `.next`.
The pnpm workspace (including `@forge/shared`) installs from the repo root automatically.

### Option B — Root Directory = empty (repo root)

Leave Root Directory blank. Vercel reads the repo-root `vercel.json`, which runs
`pnpm --filter @forge/web build` and serves `apps/web/.next`.

Either works; do not mix them. If you switch to Option A you can ignore the root `vercel.json`
(it is only read when Root Directory is the repo root).

## Required environment variables (Vercel, Forge web project)

- `OWNER_SETUP_SECRET` — required for owner first-login in production. Pick a strong value.
- `NEXT_PUBLIC_AGENT_SERVICE_URL` — the hosted agent-service URL.
- `ADMIN_SESSION_SECRET` — optional; if unset, a key is derived from `SUPABASE_SERVICE_ROLE_KEY`.
- Supabase + Stripe + model keys as documented in `.env.example`.

## Marketing site

The marketing site (separate repo `iamjoejack/saasytoad`) needs `NEXT_PUBLIC_FORGE_URL`
set to this app's domain so its "sign in" links resolve.
