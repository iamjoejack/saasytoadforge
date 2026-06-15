import Stripe from 'stripe'
import { PLANS, type BillingProvider } from './billing'
import type { Plan, CheckoutResult } from '@forge/shared'

export class StripeBillingProvider implements BillingProvider {
  readonly kind = 'stripe' as const
  public stripe: Stripe
  private planToPriceId: Record<string, string>

  constructor(secretKey: string) {
    // using latest stable as default
    this.stripe = new Stripe(secretKey, { apiVersion: '2023-10-16' as any })
    
    this.planToPriceId = {
      solo: process.env.STRIPE_PRICE_SOLO ?? 'price_solo_mock',
      pro: process.env.STRIPE_PRICE_PRO ?? 'price_pro_mock',
      agency: process.env.STRIPE_PRICE_AGENCY ?? 'price_agency_mock',
    }
  }

  plans(): readonly Plan[] {
    return PLANS
  }

  async createCheckout(planId: string, opts: { customerEmail: string }): Promise<CheckoutResult> {
    const priceId = this.planToPriceId[planId]
    if (!priceId) throw new Error('Unknown plan ID')

    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      customer_email: opts.customerEmail,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.PUBLIC_URL || 'http://localhost:3000'}?checkout=success`,
      cancel_url: `${process.env.PUBLIC_URL || 'http://localhost:3000'}/pricing`,
    })

    if (!session.url) throw new Error('Failed to create Stripe checkout session')
    return { url: session.url, mode: 'stripe' }
  }
}
