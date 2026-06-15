export interface SpendCaps {
  perUserUsd: number
  globalUsd: number
}

export interface SpendCheck {
  allowed: boolean
  reason?: string
}

export interface SpendSummary {
  userUsd: number
  globalUsd: number
  caps: SpendCaps
  userRemainingUsd: number
  globalRemainingUsd: number
}

/** Approximate USD per 1M tokens (input+output blended). Overridable later per model. */
const RATE_PER_MTOK: Readonly<Record<string, number>> = {
  'openai/gpt-4o-mini': 0.3,
  'anthropic/claude-sonnet-4': 6,
  'openrouter/fusion': 30,
}
const DEFAULT_RATE = 5

export function costForTokens(model: string, totalTokens: number): number {
  const rate = RATE_PER_MTOK[model] ?? DEFAULT_RATE
  return (totalTokens / 1_000_000) * rate
}

/**
 * In-memory spend ledger. Per-user and global caps are checked BEFORE each model call;
 * when a cap is hit the call is refused (degrade gracefully, never silently overspend).
 * Backed by Postgres in Phase 5.
 */
export class SpendLedger {
  private readonly perUser = new Map<string, number>()
  private total = 0

  record(userId: string, usd: number): void {
    this.perUser.set(userId, this.userSpend(userId) + usd)
    this.total += usd
  }

  userSpend(userId: string): number {
    return this.perUser.get(userId) ?? 0
  }

  globalSpend(): number {
    return this.total
  }

  allSpends(): Array<{ userId: string; usd: number }> {
    return [...this.perUser.entries()].map(([userId, usd]) => ({ userId, usd }))
  }

  check(userId: string, estUsd: number, caps: SpendCaps): SpendCheck {
    if (this.userSpend(userId) + estUsd > caps.perUserUsd) {
      return { allowed: false, reason: 'per-user spend cap reached' }
    }
    if (this.total + estUsd > caps.globalUsd) {
      return { allowed: false, reason: 'global spend cap reached' }
    }
    return { allowed: true }
  }

  summary(userId: string, caps: SpendCaps): SpendSummary {
    return {
      userUsd: this.userSpend(userId),
      globalUsd: this.total,
      caps,
      userRemainingUsd: Math.max(0, caps.perUserUsd - this.userSpend(userId)),
      globalRemainingUsd: Math.max(0, caps.globalUsd - this.total),
    }
  }
}
