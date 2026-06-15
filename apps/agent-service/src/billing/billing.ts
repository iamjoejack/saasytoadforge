import type { ServerEnv, Plan, CheckoutResult } from '@forge/shared'

/**
 * Flat pricing. AI is included on every plan, never metered, never a surprise bill
 * (brand rule). The internal spend caps are an operator cost control, not a customer charge.
 */
export const PLANS: readonly Plan[] = [
  {
    id: 'pro',
    name: 'Pro Builder Plan',
    priceUsd: 29,
    interval: 'month',
    blurb: 'Complete AI-powered visual development workspace.',
    features: ['AI included, never metered', 'Unlimited microVM sandboxes', 'One-click deployments', 'Zapier, GitHub, Supabase integration'],
  },
  {
    id: 'topup_10',
    name: 'Cap Extension ($10)',
    priceUsd: 10,
    interval: 'one-time',
    blurb: 'Increase your deep reasoning spend limit by $10.00.',
    features: ['Adds $10.00 to session limit', 'Supports more Fusion model calls', 'No expiration'],
  },
]

/** What a verified, paid webhook event should fulfil. */
export interface WebhookFulfillment {
  planId: string
  customerEmail?: string
  /** USD of credit to grant (one-time top-ups); 0 for recurring subscriptions. */
  creditUsd: number
}

/** Credit granted by a one-time plan. Subscriptions grant 0 (access, not credit). */
export function creditUsdForPlan(planId: string): number {
  const plan = PLANS.find((p) => p.id === planId)
  if (!plan || plan.interval !== 'one-time') return 0
  return plan.priceUsd
}

export interface BillingProvider {
  plans(): readonly Plan[]
  createCheckout(planId: string, opts: { customerEmail: string }): Promise<CheckoutResult>
  /** Verify and interpret a webhook. Returns null if not actionable; throws on a bad signature. */
  handleWebhook(rawBody: string, signature: string): Promise<WebhookFulfillment | null>
  readonly kind: 'mock' | 'stripe'
}

/** No live charge: returns a local URL. Used until STRIPE_SECRET_KEY is supplied. */
export class MockBillingProvider implements BillingProvider {
  readonly kind = 'mock' as const

  plans(): readonly Plan[] {
    return PLANS
  }

  async createCheckout(
    planId: string,
    _opts: { customerEmail: string },
  ): Promise<CheckoutResult> {
    return { url: `/pricing?selected=${encodeURIComponent(planId)}`, mode: 'mock' }
  }

  /** Mock has no live webhooks, and never grants credit without a verified payment. */
  async handleWebhook(): Promise<WebhookFulfillment | null> {
    return null
  }
}

import { StripeBillingProvider } from './stripe-billing'

export function createBillingProvider(env: ServerEnv): BillingProvider {
  if (env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET) {
    return new StripeBillingProvider(env.STRIPE_SECRET_KEY, {
      webhookSecret: env.STRIPE_WEBHOOK_SECRET,
      pricePro: env.STRIPE_PRICE_PRO,
      priceTopup10: env.STRIPE_PRICE_TOPUP_10,
      publicUrl: env.PUBLIC_URL,
    })
  }
  return new MockBillingProvider()
}
