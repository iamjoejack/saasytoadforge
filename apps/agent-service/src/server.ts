import Fastify, {
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
  type FastifyPluginAsync,
} from 'fastify'
import cors from '@fastify/cors'
import websocket from '@fastify/websocket'
import rateLimit from '@fastify/rate-limit'
import {
  parseServerEnv,
  parseEgressAllowlist,
  secretStatus,
  verifyAgentToken,
  type SandboxProvider,
  type ServerEnv,
  type AgentCommand,
  type AgentEvent,
  type ConfigSummary,
} from '@forge/shared'
import { createSandboxProvider } from './sandbox'
import { WorkspaceManager, type Workspace } from './workspace/manager'
import { assertSafePath, PathError } from './lib/paths'
import { Agent, ApprovalGate } from './agent/agent'
import { createLlmClient } from './agent/llm'
import { createPlanner } from './agent/planner'
import { createToolSet, MockBrowserTool, type BrowserTool } from './agent/tools'
import { SpendLedger, costForTokens, type SpendCaps } from './lib/spend'
import { modelRouting, resolveDeepModel, DEEP_REQUEST_CAP_USD } from './agent/router'
import { logger } from './lib/logger'
import { createBillingProvider } from './billing/billing'
import { InMemorySessionStore } from './persistence/store'
import { SupabaseSessionStore } from './persistence/supabase-store'

declare module 'fastify' {
  interface FastifyRequest {
    userId?: string
  }
}

export interface ServerDeps {
  provider: SandboxProvider
  browser: BrowserTool
  ledger: SpendLedger
}

const PUBLIC_PATHS = new Set(['/health', '/config', '/billing/plans'])
const WS_ROUTE = /\/workspaces\/[^/]+\/(shell|agent)$/

/** Estimated tokens per agent run, feeding the spend-cap pre-charge. */
const FRONTIER_EST_TOKENS = 2300
const DEEP_EST_TOKENS = 9000

export function buildServer(deps?: Partial<ServerDeps>): FastifyInstance {
  const env = parseServerEnv()
  const provider = deps?.provider ?? createSandboxProvider(env)
  const browser = deps?.browser ?? new MockBrowserTool()
  const ledger = deps?.ledger ?? new SpendLedger()
  const egressAllowlist = parseEgressAllowlist(env)
  const workspaces = new WorkspaceManager(provider, egressAllowlist)

  const allowedOrigins = env.ALLOWED_ORIGINS.split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  const app = Fastify({ logger: false })
  void app.register(cors, {
    origin: allowedOrigins.length > 0 ? allowedOrigins : ['http://localhost:3000'],
  })
  void app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  })
  void app.register(websocket)
  void app.register(routes(provider, workspaces, env, browser, ledger))

  return app
}

/** userId for the request, guaranteed set by the auth hook for protected routes. */
function userIdOf(req: FastifyRequest): string {
  return req.userId ?? ''
}

/** userId from a websocket upgrade's ?token= query, or null. */
function wsUserId(req: FastifyRequest, secret: string): string | null {
  const token = (req.query as { token?: string }).token ?? ''
  return token ? (verifyAgentToken(token, secret)?.userId ?? null) : null
}

function routes(
  provider: SandboxProvider,
  workspaces: WorkspaceManager,
  env: ServerEnv,
  browser: BrowserTool,
  ledger: SpendLedger,
): FastifyPluginAsync {
  const caps: SpendCaps = { perUserUsd: env.SPEND_CAP_USER_USD, globalUsd: env.SPEND_CAP_GLOBAL_USD }
  const secrets = secretStatus(env)
  const billing = createBillingProvider(env)
  const sessionStore = env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY
    ? new SupabaseSessionStore(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
    : new InMemorySessionStore()

  return async (app) => {
    // Auth: every REST route except PUBLIC_PATHS requires a valid signed token.
    // Websocket upgrades authenticate via ?token= in their own handlers.
    app.addHook('onRequest', async (req, reply) => {
      if (req.method === 'OPTIONS') return // CORS preflight
      const path = req.url.split('?')[0] ?? ''
      // Skip ONLY a genuine websocket upgrade to a websocket route (it authenticates via
      // ?token= in its handler). A spoofed Upgrade header on a REST route must still auth.
      if (WS_ROUTE.test(path) && (req.headers.upgrade ?? '').toLowerCase() === 'websocket') return
      if (PUBLIC_PATHS.has(path)) return
      const header = req.headers.authorization ?? ''
      const token = header.startsWith('Bearer ') ? header.slice(7) : ''
      const claims = token ? verifyAgentToken(token, env.AGENT_SERVICE_SECRET) : null
      if (!claims) {
        return reply.code(401).send({ error: 'unauthorized' })
      }
      req.userId = claims.userId
    })

    app.get('/health', async () => ({ status: 'ok', service: 'agent-service' }))

    app.get('/config', async (): Promise<ConfigSummary> => ({
      models: modelRouting(env),
      sandboxProvider: env.SANDBOX_PROVIDER,
      egressAllowlist: parseEgressAllowlist(env),
      caps: { perUserUsd: caps.perUserUsd, globalUsd: caps.globalUsd },
      secrets,
    }))

    app.get('/billing/plans', async () => billing.plans())

    app.post('/billing/checkout', async (req, reply) => {
      const body = req.body as { planId?: unknown; email?: unknown }
      if (typeof body.planId !== 'string' || !billing.plans().some((p) => p.id === body.planId)) {
        return reply.code(400).send({ error: 'unknown planId' })
      }
      const email = typeof body.email === 'string' ? body.email : 'unknown@forge.dev'
      return billing.createCheckout(body.planId, { customerEmail: email })
    })

    app.post('/webhooks/stripe', async (_req, reply) => {
      // In a full production setup, Fastify must be configured to capture the raw body
      // to verify `stripe.webhooks.constructEvent` with `env.STRIPE_WEBHOOK_SECRET`.
      // For now, we acknowledge the event to keep the webhook active.
      return reply.code(200).send({ received: true })
    })

    app.post('/workspaces', async (req) => workspaces.create(userIdOf(req)))

    app.get('/workspaces', async (req) => workspaces.list(userIdOf(req)))

    app.delete('/workspaces/:id', async (req, reply) => {
      const id = (req.params as { id: string }).id
      const ok = await workspaces.destroy(id, userIdOf(req))
      if (!ok) return reply.code(404).send({ error: 'workspace not found' })
      return { ok: true }
    })

    app.get('/workspaces/:id/files', async (req, reply) => {
      const ws = requireWorkspace(workspaces, req, reply)
      if (!ws) return
      const dir = (req.query as { dir?: string }).dir ?? ''
      return provider.listFiles(ws.sandboxId, dir)
    })

    app.get('/workspaces/:id/file', async (req, reply) => {
      const ws = requireWorkspace(workspaces, req, reply)
      if (!ws) return
      const rawPath = (req.query as { path?: string }).path
      if (typeof rawPath !== 'string') {
        return reply.code(400).send({ error: 'path query param is required' })
      }
      try {
        const path = assertSafePath(rawPath)
        const contents = await provider.readFile(ws.sandboxId, path)
        return { path, contents }
      } catch (err) {
        if (err instanceof PathError) return reply.code(400).send({ error: err.message })
        return reply.code(404).send({ error: 'file not found' })
      }
    })

    app.put('/workspaces/:id/file', async (req, reply) => {
      const ws = requireWorkspace(workspaces, req, reply)
      if (!ws) return
      const body = req.body as { path?: unknown; contents?: unknown }
      if (typeof body.path !== 'string' || typeof body.contents !== 'string') {
        return reply.code(400).send({ error: 'path and contents must be strings' })
      }
      try {
        const path = assertSafePath(body.path)
        await provider.writeFile(ws.sandboxId, path, body.contents)
        return { ok: true, path }
      } catch (err) {
        if (err instanceof PathError) return reply.code(400).send({ error: err.message })
        throw err
      }
    })

    app.get('/workspaces/:id/spend', async (req, reply) => {
      const ws = requireWorkspace(workspaces, req, reply)
      if (!ws) return
      return ledger.summary(userIdOf(req), caps)
    })

    app.get('/workspaces/:id/sessions', async (req, reply) => {
      const ws = requireWorkspace(workspaces, req, reply)
      if (!ws) return
      return sessionStore.listSessions(ws.id)
    })

    app.post('/workspaces/:id/exec', async (req, reply) => {
      const ws = requireWorkspace(workspaces, req, reply)
      if (!ws) return
      const body = req.body as { cmd?: unknown }
      if (typeof body.cmd !== 'string') {
        return reply.code(400).send({ error: 'cmd must be a string' })
      }
      return provider.exec(ws.sandboxId, body.cmd)
    })

    // Streamed shell bridged to the editor terminal (xterm).
    app.get('/workspaces/:id/shell', { websocket: true }, (socket, req) => {
      const userId = wsUserId(req, env.AGENT_SERVICE_SECRET)
      if (!userId) {
        socket.close(1008, 'unauthorized')
        return
      }
      const ws = workspaces.get((req.params as { id: string }).id, userId)
      if (!ws) {
        socket.close(1008, 'workspace not found')
        return
      }
      let shell
      try {
        shell = provider.openShell(ws.sandboxId)
      } catch {
        socket.close(1011, 'could not open shell')
        return
      }
      socket.on('message', (data: Buffer) => void shell.write(data.toString()))
      socket.on('close', () => void shell.close())
      void (async () => {
        for await (const chunk of shell.output) {
          if (socket.readyState === socket.OPEN) socket.send(chunk)
        }
      })()
    })

    // Streamed agent loop: client sends AgentCommand, server streams AgentEvent.
    app.get('/workspaces/:id/agent', { websocket: true }, (socket, req) => {
      const userId = wsUserId(req, env.AGENT_SERVICE_SECRET)
      if (!userId) {
        socket.close(1008, 'unauthorized')
        return
      }
      const ws = workspaces.get((req.params as { id: string }).id, userId)
      if (!ws) {
        socket.close(1008, 'workspace not found')
        return
      }

      const approvals = new ApprovalGate()
      const agent = new Agent(createToolSet(provider, ws.sandboxId, browser))
      let activeSessionId: string | null = null
      let running = false
      let abort: AbortController | null = null

      const send = (event: AgentEvent) => {
        if (activeSessionId) void sessionStore.appendArtifact(activeSessionId, event)
        if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(event))
      }

      // On disconnect: stop the in-flight run and unblock any pending approval.
      socket.on('close', () => {
        abort?.abort()
        approvals.rejectAll()
      })

      socket.on('message', async (data: Buffer) => {
        let cmd: AgentCommand
        try {
          cmd = JSON.parse(data.toString()) as AgentCommand
        } catch {
          return
        }

        if (cmd.type === 'cancel') {
          abort?.abort()
          approvals.rejectAll()
          return
        }
        if (cmd.type === 'approve') {
          approvals.resolve(cmd.id, true)
          return
        }
        if (cmd.type === 'reject') {
          approvals.resolve(cmd.id, false)
          return
        }
        if (cmd.type !== 'task') return

        if (typeof cmd.task !== 'string' || cmd.task.trim() === '') {
          send({ type: 'error', message: 'task must be a non-empty string' })
          send({ type: 'done', ok: false })
          return
        }
        if (running) {
          send({ type: 'error', message: 'a task is already running' })
          send({ type: 'done', ok: false })
          return
        }

        const model = cmd.deep
          ? resolveDeepModel(env, { fusionAvailable: secrets.openrouter })
          : modelRouting(env).frontier
        const estUsd = costForTokens(model, cmd.deep ? DEEP_EST_TOKENS : FRONTIER_EST_TOKENS)

        // Gated deep reasoning is capped per request.
        if (cmd.deep && estUsd > DEEP_REQUEST_CAP_USD) {
          send({ type: 'error', message: 'Deep reasoning exceeds the per-request cap.' })
          send({ type: 'done', ok: false })
          return
        }
        // Enforce the per-user spend cap BEFORE the model call.
        const check = ledger.check(userId, estUsd, caps)
        if (!check.allowed) {
          send({ type: 'error', message: `Spend cap reached: ${check.reason}.` })
          send({ type: 'done', ok: false })
          return
        }
        ledger.record(userId, estUsd)
        running = true
        abort = new AbortController()
        const session = await sessionStore.createSession(ws.id, cmd.task)
        activeSessionId = session.id
        logger.info('agent run', {
          workspace: ws.id,
          session: activeSessionId,
          model,
          deep: Boolean(cmd.deep),
          estUsd,
        })

        const planner = createPlanner(env, createLlmClient(env))
        void agent
          .run(
            {
              task: cmd.task,
              planner,
              approvals,
              requireWriteApproval: cmd.requireWriteApproval,
              signal: abort.signal,
            },
            send,
          )
          .finally(() => {
            running = false
          })
      })
    })
  }
}

function requireWorkspace(
  workspaces: WorkspaceManager,
  req: FastifyRequest,
  reply: FastifyReply,
): Workspace | undefined {
  const id = (req.params as { id?: string }).id ?? ''
  const ws = workspaces.get(id, userIdOf(req))
  if (!ws) {
    void reply.code(404).send({ error: 'workspace not found' })
    return undefined
  }
  return ws
}
