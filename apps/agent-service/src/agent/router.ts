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
