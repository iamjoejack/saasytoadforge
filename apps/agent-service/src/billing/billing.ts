import type { ServerEnv, Plan, CheckoutResult } from '@forge/shared'

/**
 * Flat pricing. AI is included on every plan, never metered, never a surprise bill
 * (brand rule). The internal spend caps are an operator cost control, not a customer charge.
 */
export const PLANS: readonly Plan[] = [
  {
    id: 'solo',
    name: 'Solo',
    priceUsd: 49,
    interval: 'month',
    blurb: 'For one builder.',
    features: ['1 seat', 'AI included, never metered', 'Isolated sandboxes', 'Real people you can reach'],
  },
  {
    id: 'pro',
    name: 'Pro',
    priceUsd: 99,
    interval: 'month',
    blurb: 'For a small team.',
    features: ['5 seats', 'AI included, never metered', 'Priority sandboxes', 'Approval workflows'],
  },
  {
    id: 'agency',
    name: 'Agency',
    priceUsd: 249,
    interval: 'month',
    blurb: 'For agencies running many clients.',
    features: ['Unlimited seats', 'AI included, never metered', 'White-label', 'Audit log'],
  },
]

export interface BillingProvider {
  plans(): readonly Plan[]
  createCheckout(planId: string, opts: { customerEmail: string }): Promise<CheckoutResult>
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
}

export function createBillingProvider(env: ServerEnv): BillingProvider {
  // HUMAN-INPUT NEEDED: STRIPE_SECRET_KEY. A StripeBillingProvider that creates real
  // Checkout sessions drops in here; no live charge without explicit approval.
  if (env.STRIPE_SECRET_KEY) return new MockBillingProvider()
  return new MockBillingProvider()
}
