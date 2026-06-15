import { describe, it, expect } from 'vitest'
import type { AddressInfo } from 'node:net'
import { WebSocket } from 'ws'
import { buildServer } from '../server'
import { MockSandboxProvider } from '../sandbox'

describe('shell websocket', () => {
  it('streams the prompt and command output back to the client', async () => {
    const server = buildServer({ provider: new MockSandboxProvider() })
    await server.listen({ port: 0, host: '127.0.0.1' })
    const { port } = server.server.address() as AddressInfo

    const create = await server.inject({ method: 'POST', url: '/workspaces' })
    const id = create.json<{ id: string }>().id

    const socket = new WebSocket(`ws://127.0.0.1:${port}/workspaces/${id}/shell`)
    const chunks: string[] = []

    try {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('shell stream timeout')), 4000)
        // xterm sends CR on Enter.
        socket.on('open', () => socket.send('echo streamed\r'))
        socket.on('message', (data: Buffer) => {
          chunks.push(data.toString())
          if (chunks.join('').includes('streamed\r\nforge:/workspace$')) {
            clearTimeout(timer)
            resolve()
          }
        })
        socket.on('error', reject)
      })

      const transcript = chunks.join('')
      expect(transcript).toContain('$') // prompt
      expect(transcript).toContain('streamed\r\n') // command output (CRLF for the terminal)
      expect(transcript.split('forge:/workspace$').length).toBeGreaterThanOrEqual(2) // reprompt
    } finally {
      socket.close()
      await server.close()
    }
  })
})
