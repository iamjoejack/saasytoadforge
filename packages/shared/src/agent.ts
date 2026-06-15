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
  | { type: 'question'; id: string; question: string; options: string[]; isMultiSelect: boolean }
  | { type: 'done'; ok: boolean }
  | { type: 'error'; message: string }

/** Client -> agent messages over the same socket. */
export type AgentCommand =
  | {
      type: 'task'
      task: string
      requireWriteApproval?: boolean
      /**
       * @deprecated Use modelTier instead. Kept for backward compat: deep=true maps to 'fusion'.
       */
      deep?: boolean
      /**
       * Named model tier. Fusion is preserved and NOT bypassed by this.
       * - 'fast'     → MODEL_FAST env var (cheapest, free models)
       * - 'frontier' → MODEL_FRONTIER env var (claude-sonnet-4 etc)
       * - 'fusion'   → MODEL_DEEP = openrouter/fusion (3-model panel, best reasoning)
       * - 'custom'   → use customModelId (single model, bypasses fusion by user intent)
       */
      modelTier?: 'fast' | 'frontier' | 'fusion' | 'custom'
      /** Only used when modelTier = 'custom'. A raw OpenRouter model ID. */
      customModelId?: string
      customKeys?: { anthropic?: string; google?: string }
    }
  | { type: 'approve'; id: string }
  | { type: 'reject'; id: string }
  | { type: 'answer'; id: string; selection: string[] }
  | { type: 'cancel' }
  /** Sent by client to top-up credits and allow unlimited spend to continue. */
  | { type: 'spend_topup'; approvalId: string; blockUsd: number }
  /** Toggle unlimited top-up mode for this session. */
  | { type: 'spend_topup_mode'; enabled: boolean }

export interface ConfigSummary {
  models: ModelRouting
  sandboxProvider: string
  egressAllowlist: string[]
  caps: { perUserUsd: number; globalUsd: number; unlimitedMode?: boolean; approvalBlockUsd?: number }
  secrets: {
    openrouter: boolean
    e2b: boolean
    supabase: boolean
    stripe: boolean
    upstashRedis: boolean
    resend: boolean
    vercel: boolean
    zapier: boolean
  }
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
