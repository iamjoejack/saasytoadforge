import Stripe from 'stripe'
import { PLANS, creditUsdForPlan, type BillingProvider, type WebhookFulfillment } from './billing'
import type { Plan, CheckoutResult } from '@forge/shared'

export interface StripeBillingOptions {
  webhookSecret?: string
  pricePro?: string
  priceTopup10?: string
  publicUrl?: string
}

export class StripeBillingProvider implements BillingProvider {
  readonly kind = 'stripe' as const
  public stripe: Stripe
  private readonly planToPriceId: Record<string, string>
  private readonly webhookSecret?: string
  private readonly publicUrl: string

  constructor(secretKey: string, opts: StripeBillingOptions = {}) {
    // Use the SDK's pinned API version (no cast, no `any`).
    this.stripe = new Stripe(secretKey)
    this.webhookSecret = opts.webhookSecret
    this.publicUrl = opts.publicUrl ?? 'http://localhost:3000'
    this.planToPriceId = {
      pro: opts.pricePro ?? 'price_pro_mock',
      topup_10: opts.priceTopup10 ?? 'price_topup_10_mock',
    }
  }

  plans(): readonly Plan[] {
    return PLANS
  }

  async createCheckout(planId: string, opts: { customerEmail: string }): Promise<CheckoutResult> {
    const priceId = this.planToPriceId[planId]
    if (!priceId) throw new Error('Unknown plan ID')

    const isSubscription = planId !== 'topup_10'

    const session = await this.stripe.checkout.sessions.create({
      mode: isSubscription ? 'subscription' : 'payment',
      customer_email: opts.customerEmail,
      // planId travels with the session so the webhook can fulfil it without a price lookup.
      metadata: { planId },
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${this.publicUrl}?checkout=success`,
      cancel_url: `${this.publicUrl}/pricing`,
    })

    if (!session.url) throw new Error('Failed to create Stripe checkout session')
    return { url: session.url, mode: 'stripe' }
  }

  /**
   * Verify the webhook signature and return what to fulfil, or null if the event is not
   * actionable. Throws when the signature is missing or invalid so the caller returns 400.
   */
  async handleWebhook(rawBody: string, signature: string): Promise<WebhookFulfillment | null> {
    if (!this.webhookSecret) throw new Error('STRIPE_WEBHOOK_SECRET is not configured')
    // constructEvent throws on a bad signature: never trust an unverified event.
    const event = this.stripe.webhooks.constructEvent(rawBody, signature, this.webhookSecret)

    if (event.type !== 'checkout.session.completed') return null
    const session = event.data.object as Stripe.Checkout.Session
    if (session.payment_status && session.payment_status !== 'paid') return null

    const planId = session.metadata?.planId ?? ''
    if (!planId) return null
    return {
      planId,
      customerEmail: session.customer_email ?? session.customer_details?.email ?? undefined,
      creditUsd: creditUsdForPlan(planId),
    }
  }
}
