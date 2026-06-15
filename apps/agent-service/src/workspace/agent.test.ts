import { describe, it, expect } from 'vitest'
import type { AddressInfo } from 'node:net'
import { WebSocket } from 'ws'
import { type AgentEvent, mintAgentToken, DEFAULT_AGENT_SERVICE_SECRET } from '@forge/shared'
import { buildServer } from '../server'
import { MockSandboxProvider } from '../sandbox'
import { MockBrowserTool } from '../agent/tools'
import { SpendLedger } from '../lib/spend'

const TOKEN = mintAgentToken('alice', DEFAULT_AGENT_SERVICE_SECRET)
const AUTH = { authorization: `Bearer ${TOKEN}` }

describe('agent websocket', () => {
  it('runs the canonical task and streams plan, edits, terminal, done', async () => {
    const server = buildServer({ provider: new MockSandboxProvider(), browser: new MockBrowserTool() })
    await server.listen({ port: 0, host: '127.0.0.1' })
    const { port } = server.server.address() as AddressInfo
    const id = (
      await server.inject({ method: 'POST', url: '/workspaces', headers: AUTH })
    ).json<{ id: string }>().id

    const socket = new WebSocket(`ws://127.0.0.1:${port}/workspaces/${id}/agent?token=${TOKEN}`)
    const events: AgentEvent[] = []

    try {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('agent run timeout')), 5000)
        socket.on('open', () =>
          socket.send(
            JSON.stringify({ type: 'task', task: 'add a current time endpoint and a test for it' }),
          ),
        )
        socket.on('message', (data: Buffer) => {
          const event = JSON.parse(data.toString()) as AgentEvent
          events.push(event)
          if (event.type === 'done') {
            clearTimeout(timer)
            resolve()
          }
        })
        socket.on('error', reject)
      })

      expect(events.some((e) => e.type === 'plan')).toBe(true)
      expect(events.filter((e) => e.type === 'edit')).toHaveLength(2)

      const terminal = events.find((e) => e.type === 'terminal')
      if (terminal?.type !== 'terminal') throw new Error('no terminal event')
      expect(terminal.result.exitCode).toBe(0)
      expect(terminal.result.stdout).toContain('pass 1')

      const done = events.at(-1)
      if (done?.type !== 'done') throw new Error('no done event')
      expect(done.ok).toBe(true)

      // The session and its artifacts were persisted.
      const sessionsRes = await server.inject({
        method: 'GET',
        url: `/workspaces/${id}/sessions`,
        headers: AUTH,
      })
      const sessions = sessionsRes.json<Array<{ task: string; artifacts: Array<{ type: string }> }>>()
      expect(sessions).toHaveLength(1)
      const kinds = sessions[0]?.artifacts.map((a) => a.type) ?? []
      expect(kinds).toContain('edit')
      expect(kinds).toContain('terminal')
    } finally {
      socket.close()
      await server.close()
    }
  })

  it('closes the agent socket (1008) for missing, garbage, or non-owner tokens', async () => {
    const server = buildServer({ provider: new MockSandboxProvider(), browser: new MockBrowserTool() })
    await server.listen({ port: 0, host: '127.0.0.1' })
    const { port } = server.server.address() as AddressInfo
    const id = (
      await server.inject({ method: 'POST', url: '/workspaces', headers: AUTH })
    ).json<{ id: string }>().id
    const bobToken = mintAgentToken('bob', DEFAULT_AGENT_SERVICE_SECRET)

    const closeCode = (url: string) =>
      new Promise<number>((resolve, reject) => {
        const s = new WebSocket(url)
        const timer = setTimeout(() => reject(new Error('no close')), 3000)
        s.on('close', (code) => {
          clearTimeout(timer)
          resolve(code)
        })
        s.on('error', () => {})
      })

    try {
      const base = `ws://127.0.0.1:${port}/workspaces/${id}/agent`
      expect(await closeCode(base)).toBe(1008) // no token
      expect(await closeCode(`${base}?token=garbage`)).toBe(1008) // bad token
      expect(await closeCode(`${base}?token=${bobToken}`)).toBe(1008) // valid non-owner
    } finally {
      await server.close()
    }
  })

  it('blocks the run when the per-user spend cap is exceeded', async () => {
    const ledger = new SpendLedger()
    ledger.record('alice', 1000) // far past the cap
    const server = buildServer({
      provider: new MockSandboxProvider(),
      browser: new MockBrowserTool(),
      ledger,
    })
    await server.listen({ port: 0, host: '127.0.0.1' })
    const { port } = server.server.address() as AddressInfo
    const id = (
      await server.inject({ method: 'POST', url: '/workspaces', headers: AUTH })
    ).json<{ id: string }>().id

    const socket = new WebSocket(`ws://127.0.0.1:${port}/workspaces/${id}/agent?token=${TOKEN}`)
    const events: AgentEvent[] = []
    try {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('timeout')), 4000)
        socket.on('open', () => socket.send(JSON.stringify({ type: 'task', task: 'time endpoint' })))
        socket.on('message', (data: Buffer) => {
          const e = JSON.parse(data.toString()) as AgentEvent
          events.push(e)
          if (e.type === 'done') {
            clearTimeout(timer)
            resolve()
          }
        })
        socket.on('error', reject)
      })
      expect(events.some((e) => e.type === 'error' && /cap/i.test(e.message))).toBe(true)
      expect(events.some((e) => e.type === 'edit')).toBe(false)
      const done = events.at(-1)
      expect(done?.type === 'done' && done.ok).toBe(false)
    } finally {
      socket.close()
      await server.close()
    }
  })
})
