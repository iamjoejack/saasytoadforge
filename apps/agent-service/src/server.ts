import Fastify, {
  type FastifyInstance,
  type FastifyReply,
  type FastifyPluginAsync,
} from 'fastify'
import cors from '@fastify/cors'
import websocket from '@fastify/websocket'
import {
  parseServerEnv,
  type SandboxProvider,
  type ServerEnv,
  type AgentCommand,
  type AgentEvent,
} from '@forge/shared'
import { createSandboxProvider } from './sandbox'
import { WorkspaceManager, type Workspace } from './workspace/manager'
import { assertSafePath, PathError } from './lib/paths'
import { Agent, ApprovalGate } from './agent/agent'
import { createLlmClient } from './agent/llm'
import { createPlanner } from './agent/planner'
import { createToolSet, PlaywrightBrowserTool, type BrowserTool } from './agent/tools'

export interface ServerDeps {
  provider: SandboxProvider
  browser: BrowserTool
}

/**
 * Builds the agent-service app. A provider can be injected for deterministic tests;
 * otherwise it is resolved from env (mock unless real sandbox credentials are present).
 *
 * Routes live in a nested plugin registered AFTER @fastify/websocket so that the
 * plugin's onRoute hook is active when the `{ websocket: true }` routes are added.
 */
export function buildServer(deps?: Partial<ServerDeps>): FastifyInstance {
  const env = parseServerEnv()
  const provider = deps?.provider ?? createSandboxProvider(env)
  const browser = deps?.browser ?? new PlaywrightBrowserTool()
  const workspaces = new WorkspaceManager(provider)

  const app = Fastify({ logger: false })
  void app.register(cors, { origin: true })
  void app.register(websocket)
  void app.register(routes(provider, workspaces, env, browser))

  return app
}

function routes(
  provider: SandboxProvider,
  workspaces: WorkspaceManager,
  env: ServerEnv,
  browser: BrowserTool,
): FastifyPluginAsync {
  return async (app) => {
    app.get('/health', async () => ({ status: 'ok', service: 'agent-service' }))

    app.post('/workspaces', async () => workspaces.create())

    app.get('/workspaces', async () => workspaces.list())

    app.get('/workspaces/:id/files', async (req, reply) => {
      const ws = requireWorkspace(workspaces, req.params, reply)
      if (!ws) return
      const dir = (req.query as { dir?: string }).dir ?? ''
      return provider.listFiles(ws.sandboxId, dir)
    })

    app.get('/workspaces/:id/file', async (req, reply) => {
      const ws = requireWorkspace(workspaces, req.params, reply)
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
      const ws = requireWorkspace(workspaces, req.params, reply)
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

    app.post('/workspaces/:id/exec', async (req, reply) => {
      const ws = requireWorkspace(workspaces, req.params, reply)
      if (!ws) return
      const body = req.body as { cmd?: unknown }
      if (typeof body.cmd !== 'string') {
        return reply.code(400).send({ error: 'cmd must be a string' })
      }
      return provider.exec(ws.sandboxId, body.cmd)
    })

    // Streamed shell bridged to the editor terminal (xterm).
    app.get('/workspaces/:id/shell', { websocket: true }, (socket, req) => {
      const ws = workspaces.get((req.params as { id: string }).id)
      if (!ws) {
        socket.close(1008, 'workspace not found')
        return
      }
      const shell = provider.openShell(ws.sandboxId)

      // Attach the message handler synchronously before starting async work.
      socket.on('message', (data: Buffer) => {
        void shell.write(data.toString())
      })
      socket.on('close', () => {
        void shell.close()
      })

      void (async () => {
        for await (const chunk of shell.output) {
          if (socket.readyState === socket.OPEN) socket.send(chunk)
        }
      })()
    })

    // Streamed agent loop: client sends AgentCommand, server streams AgentEvent.
    app.get('/workspaces/:id/agent', { websocket: true }, (socket, req) => {
      const ws = workspaces.get((req.params as { id: string }).id)
      if (!ws) {
        socket.close(1008, 'workspace not found')
        return
      }
      const approvals = new ApprovalGate()
      const agent = new Agent(createToolSet(provider, ws.sandboxId, browser))
      const send = (event: AgentEvent) => {
        if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(event))
      }

      socket.on('message', (data: Buffer) => {
        let cmd: AgentCommand
        try {
          cmd = JSON.parse(data.toString()) as AgentCommand
        } catch {
          return
        }
        if (cmd.type === 'task') {
          const planner = createPlanner(env, createLlmClient(env))
          void agent.run(
            {
              task: cmd.task,
              planner,
              approvals,
              requireWriteApproval: cmd.requireWriteApproval,
            },
            send,
          )
        } else if (cmd.type === 'approve') {
          approvals.resolve(cmd.id, true)
        } else if (cmd.type === 'reject') {
          approvals.resolve(cmd.id, false)
        }
      })
    })
  }
}

function requireWorkspace(
  workspaces: WorkspaceManager,
  params: unknown,
  reply: FastifyReply,
): Workspace | undefined {
  const id = (params as { id?: string }).id ?? ''
  const ws = workspaces.get(id)
  if (!ws) {
    void reply.code(404).send({ error: 'workspace not found' })
    return undefined
  }
  return ws
}
