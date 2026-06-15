import { describe, it, expect } from 'vitest'
import { InMemorySessionStore } from './store'

describe('InMemorySessionStore', () => {
  it('records sessions and keeps only artifact-bearing events', async () => {
    const store = new InMemorySessionStore()
    const session = await store.createSession('ws1', 'do a thing')
    await store.appendArtifact(session.id, { type: 'message', text: 'hi' })
    await store.appendArtifact(session.id, { type: 'step', id: 's1', status: 'done' }) // transient
    await store.appendArtifact(session.id, {
      type: 'terminal',
      result: { cmd: 'x', stdout: '', stderr: '', exitCode: 0 },
    })

    const sessions = await store.listSessions('ws1')
    expect(sessions).toHaveLength(1)
    expect(sessions[0]?.task).toBe('do a thing')
    expect(sessions[0]?.artifacts.map((a) => a.type)).toEqual(['message', 'terminal'])
  })

  it('scopes sessions by workspace', async () => {
    const store = new InMemorySessionStore()
    await store.createSession('ws1', 'a')
    await store.createSession('ws2', 'b')
    expect(await store.listSessions('ws1')).toHaveLength(1)
    expect(await store.listSessions('ws2')).toHaveLength(1)
    expect(await store.listSessions('nope')).toHaveLength(0)
  })
})
