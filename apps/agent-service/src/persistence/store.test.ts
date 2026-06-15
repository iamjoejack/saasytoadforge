import { describe, it, expect } from 'vitest'
import { InMemorySessionStore } from './store'

describe('InMemorySessionStore', () => {
  it('records sessions and keeps only artifact-bearing events', () => {
    const store = new InMemorySessionStore()
    const session = store.createSession('ws1', 'do a thing')
    store.appendArtifact(session.id, { type: 'message', text: 'hi' })
    store.appendArtifact(session.id, { type: 'step', id: 's1', status: 'done' }) // transient
    store.appendArtifact(session.id, {
      type: 'terminal',
      result: { cmd: 'x', stdout: '', stderr: '', exitCode: 0 },
    })

    const sessions = store.listSessions('ws1')
    expect(sessions).toHaveLength(1)
    expect(sessions[0]?.task).toBe('do a thing')
    expect(sessions[0]?.artifacts.map((a) => a.type)).toEqual(['message', 'terminal'])
  })

  it('scopes sessions by workspace', () => {
    const store = new InMemorySessionStore()
    store.createSession('ws1', 'a')
    store.createSession('ws2', 'b')
    expect(store.listSessions('ws1')).toHaveLength(1)
    expect(store.listSessions('ws2')).toHaveLength(1)
    expect(store.listSessions('nope')).toHaveLength(0)
  })
})
