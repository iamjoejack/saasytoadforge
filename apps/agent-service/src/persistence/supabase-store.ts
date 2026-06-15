import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { AgentEvent } from '@forge/shared'
import type { SessionStore, StoredSession } from './store'

const PERSISTED = new Set<AgentEvent['type']>(['message', 'plan', 'edit', 'terminal', 'screenshot'])

export class SupabaseSessionStore implements SessionStore {
  readonly kind = 'supabase' as const
  private supabase: SupabaseClient

  constructor(supabaseUrl: string, supabaseServiceRoleKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseServiceRoleKey)
  }

  async createSession(workspaceId: string, task: string): Promise<StoredSession> {
    const { data, error } = await this.supabase
      .from('agent_sessions')
      .insert({ workspace_id: workspaceId, task })
      .select()
      .single()
      
    if (error || !data) throw new Error(`Failed to create session: ${error?.message}`)
    
    return {
      id: data.id,
      workspaceId: data.workspace_id,
      task: data.task,
      createdAt: data.created_at,
      artifacts: [],
    }
  }

  async appendArtifact(sessionId: string, event: AgentEvent): Promise<void> {
    if (!PERSISTED.has(event.type)) return
    
    const { error } = await this.supabase
      .from('artifacts')
      .insert({ session_id: sessionId, kind: event.type, payload: event })
      
    if (error) console.error('Failed to append artifact:', error.message)
  }

  async listSessions(workspaceId: string): Promise<StoredSession[]> {
    const { data, error } = await this.supabase
      .from('agent_sessions')
      .select('*, artifacts(kind, payload, created_at)')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      
    if (error) throw new Error(`Failed to list sessions: ${error.message}`)
    
    return (data || []).map((row: any) => ({
      id: row.id,
      workspaceId: row.workspace_id,
      task: row.task,
      createdAt: row.created_at,
      artifacts: (row.artifacts || [])
        .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        .map((a: any) => a.payload as AgentEvent),
    }))
  }
}
