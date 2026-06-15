import { describe, it, expect } from 'vitest'
import type { AddressInfo } from 'node:net'
import { WebSocket } from 'ws'
import type { AgentEvent } from '@forge/shared'
import { buildServer } from '../server'
import { MockSandboxProvider } from '../sandbox'
import { MockBrowserTool } from '../agent/tools'

describe('agent websocket', () => {
  it('runs the canonical task and streams plan, edits, terminal, done', async () => {
    const server = buildServer({ provider: new MockSandboxProvider(), browser: new MockBrowserTool() })
    await server.listen({ port: 0, host: '127.0.0.1' })
    const { port } = server.server.address() as AddressInfo
    const id = (await server.inject({ method: 'POST', url: '/workspaces' })).json<{ id: string }>().id

    const socket = new WebSocket(`ws://127.0.0.1:${port}/workspaces/${id}/agent`)
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
    } finally {
      socket.close()
      await server.close()
    }
  })
})
