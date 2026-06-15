import { randomUUID } from 'node:crypto'
import type { AgentEvent } from '@forge/shared'

/** Which streamed events are kept as durable artifacts (skip transient step/approval/done). */
const PERSISTED = new Set<AgentEvent['type']>(['message', 'plan', 'edit', 'terminal', 'screenshot'])

export interface StoredSession {
  id: string
  workspaceId: string
  task: string
  createdAt: string
  artifacts: AgentEvent[]
}

export interface SessionStore {
  createSession(workspaceId: string, task: string): StoredSession
  appendArtifact(sessionId: string, event: AgentEvent): void
  listSessions(workspaceId: string): StoredSession[]
  readonly kind: 'memory' | 'supabase'
}

/**
 * In-memory session + artifact history. Supabase Postgres is the drop-in (schema +
 * row-level security already in supabase/migrations/0001_init.sql).
 */
export class InMemorySessionStore implements SessionStore {
  readonly kind = 'memory' as const
  private readonly sessions = new Map<string, StoredSession>()

  createSession(workspaceId: string, task: string): StoredSession {
    const session: StoredSession = {
      id: randomUUID(),
      workspaceId,
      task,
      createdAt: new Date().toISOString(),
      artifacts: [],
    }
    this.sessions.set(session.id, session)
    return session
  }

  appendArtifact(sessionId: string, event: AgentEvent): void {
    if (!PERSISTED.has(event.type)) return
    this.sessions.get(sessionId)?.artifacts.push(event)
  }

  listSessions(workspaceId: string): StoredSession[] {
    return [...this.sessions.values()].filter((s) => s.workspaceId === workspaceId)
  }
}
