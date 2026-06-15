/** Shared agent + artifact types, used by the agent runtime and the web client. */

export type AgentRole = 'orchestrator' | 'coder' | 'verifier' | 'browser'

export type PlanStepStatus = 'pending' | 'running' | 'done' | 'failed' | 'skipped'

export interface PlanStep {
  id: string
  title: string
  status: PlanStepStatus
  role?: AgentRole
}

export interface TerminalResult {
  cmd: string
  stdout: string
  stderr: string
  exitCode: number
}

/** Events streamed from the agent loop to the client over the agent websocket. */
export type AgentEvent =
  | { type: 'message'; text: string; agent?: AgentRole }
  | { type: 'plan'; steps: PlanStep[] }
  | { type: 'step'; id: string; status: PlanStepStatus }
  | { type: 'edit'; path: string; diff: string; before?: string; agent?: AgentRole }
  | { type: 'terminal'; result: TerminalResult; agent?: AgentRole }
  | { type: 'screenshot'; label: string; image: string; agent?: AgentRole }
  | { type: 'approval'; id: string; action: string; detail: string }
  | { type: 'done'; ok: boolean }
  | { type: 'error'; message: string }

/** Client -> agent messages over the same socket. */
export type AgentCommand =
  | {
      type: 'task'
      task: string
      requireWriteApproval?: boolean
      deep?: boolean
      customKeys?: { anthropic?: string; google?: string }
    }
  | { type: 'approve'; id: string }
  | { type: 'reject'; id: string }
  | { type: 'cancel' }

export interface ConfigSummary {
  models: ModelRouting
  sandboxProvider: string
  egressAllowlist: string[]
  caps: { perUserUsd: number; globalUsd: number }
  secrets: { openrouter: boolean; e2b: boolean; supabase: boolean; stripe: boolean }
}

export interface SpendSummaryDto {
  userUsd: number
  globalUsd: number
  caps: { perUserUsd: number; globalUsd: number }
  userRemainingUsd: number
  globalRemainingUsd: number
}

export interface SessionDto {
  id: string
  workspaceId: string
  task: string
  createdAt: string
  artifacts: AgentEvent[]
}

export interface ModelRouting {
  /** inline edits, routine steps */
  fast: string
  /** planning, multi-file work, review */
  frontier: string
  /** gated deep reasoning (OpenRouter Fusion) */
  deep: string
}

export type ModelTier = keyof ModelRouting
