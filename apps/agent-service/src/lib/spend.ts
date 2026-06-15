export interface SpendCaps {
  perUserUsd: number
  globalUsd: number
  /** When true the per-user hard cap is removed; hitting the soft limit triggers an approval event instead. */
  unlimitedMode?: boolean
  /** USD per approval block in unlimited mode (default $5). */
  approvalBlockUsd?: number
  /** Max USD to auto-approve in unlimited mode without prompting (0 = always prompt). */
  autoApproveUsd?: number
}

export interface SpendCheck {
  allowed: boolean
  /** Hard-blocked reason (unlimited mode OFF). */
  reason?: string
  /** Soft-cap hit in unlimited mode — must gate behind an approval event before proceeding. */
  needsApproval?: boolean
  approvalDetail?: string
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
  private readonly userExtraCredits = new Map<string, number>()
  /** Extra credits keyed by email, so a paid top-up (webhook carries only the email) is attributable. */
  private readonly emailExtraCredits = new Map<string, number>()
  private total = 0

  record(userId: string, usd: number): void {
    this.perUser.set(userId, this.userSpend(userId) + usd)
    this.total += usd
  }

  userSpend(userId: string): number {
    return this.perUser.get(userId) ?? 0
  }

  addExtraCredits(userId: string, usd: number): void {
    this.userExtraCredits.set(userId, (this.userExtraCredits.get(userId) ?? 0) + usd)
  }

  userExtraCreditsAmount(userId: string): number {
    return this.userExtraCredits.get(userId) ?? 0
  }

  /** Credit a paid top-up by email (fulfilled from a verified Stripe webhook). */
  addEmailCredits(email: string, usd: number): void {
    const key = email.toLowerCase()
    this.emailExtraCredits.set(key, (this.emailExtraCredits.get(key) ?? 0) + usd)
  }

  emailCreditsAmount(email?: string): number {
    if (!email) return 0
    return this.emailExtraCredits.get(email.toLowerCase()) ?? 0
  }

  globalSpend(): number {
    return this.total
  }

  allSpends(): Array<{ userId: string; usd: number }> {
    return [...this.perUser.entries()].map(([userId, usd]) => ({ userId, usd }))
  }

  check(userId: string, estUsd: number, caps: SpendCaps, email?: string): SpendCheck {
    const userCap =
      caps.perUserUsd + this.userExtraCreditsAmount(userId) + this.emailCreditsAmount(email)
    const userSpend = this.userSpend(userId)

    // Global cap is always enforced regardless of unlimited mode.
    if (this.total + estUsd > caps.globalUsd) {
      return { allowed: false, reason: 'global spend cap reached' }
    }

    if (userSpend + estUsd > userCap) {
      if (caps.unlimitedMode) {
        // Unlimited mode: soft-cap hit — surface an approval prompt rather than blocking.
        const blockUsd = caps.approvalBlockUsd ?? 5
        return {
          allowed: false,
          needsApproval: true,
          approvalDetail:
            `You have reached your $${userCap.toFixed(2)} base credit limit. ` +
            `Approve a $${blockUsd.toFixed(2)} credit extension to continue this run?`,
        }
      }
      return { allowed: false, reason: `per-user spend cap of $${userCap.toFixed(2)} reached` }
    }
    return { allowed: true }
  }

  summary(userId: string, caps: SpendCaps, email?: string): SpendSummary {
    const userCap =
      caps.perUserUsd + this.userExtraCreditsAmount(userId) + this.emailCreditsAmount(email)
    return {
      userUsd: this.userSpend(userId),
      globalUsd: this.total,
      caps: { ...caps, perUserUsd: userCap },
      userRemainingUsd: Math.max(0, userCap - this.userSpend(userId)),
      globalRemainingUsd: Math.max(0, caps.globalUsd - this.total),
    }
  }
}
