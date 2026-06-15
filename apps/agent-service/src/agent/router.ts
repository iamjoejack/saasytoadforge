import type { ModelRouting, ModelTier, ServerEnv } from '@forge/shared'

/**
 * Model routing pulled from env (never hardcoded in business logic). The deep tier
 * (OpenRouter Fusion) is user-triggered and capped; that gating lands in Phase 4.
 */
export function modelRouting(env: ServerEnv): ModelRouting {
  return {
    fast: env.MODEL_FAST,
    frontier: env.MODEL_FRONTIER,
    deep: env.MODEL_DEEP,
  }
}

export function modelFor(env: ServerEnv, tier: ModelTier): string {
  return modelRouting(env)[tier]
}

/** Per-request cap for the gated deep-reasoning tier (Fusion runs a panel + judge, ~4-5x cost). */
export const DEEP_REQUEST_CAP_USD = 0.5

/**
 * Deep reasoning is user-triggered only and never on the hot path. If Fusion is
 * unavailable, degrade gracefully to the frontier tier (mission section 9).
 */
export function resolveDeepModel(env: ServerEnv, opts: { fusionAvailable: boolean }): string {
  return opts.fusionAvailable ? modelFor(env, 'deep') : modelFor(env, 'frontier')
}
