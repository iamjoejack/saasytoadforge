import { describe, it, expect } from 'vitest'
import { parseServerEnv } from '@forge/shared'
import { PLANS, MockBillingProvider, createBillingProvider } from './billing'

describe('billing plans', () => {
  it('offers flat plans with AI included and no metering', () => {
    expect(PLANS.map((p) => p.id)).toEqual(['pro', 'topup_10'])
    for (const plan of PLANS) {
      expect(plan.priceUsd).toBeGreaterThan(0)
      if (plan.interval !== 'one-time') {
        expect(plan.features.some((f) => /never metered/i.test(f))).toBe(true)
      }
    }
  })
})

describe('MockBillingProvider', () => {
  it('returns a local checkout url and never charges', async () => {
    const result = await new MockBillingProvider().createCheckout('pro', {
      customerEmail: 'me@forge.dev',
    })
    expect(result.mode).toBe('mock')
    expect(result.url).toContain('pro')
  })
})

describe('createBillingProvider', () => {
  it('uses the mock provider without a Stripe key', () => {
    expect(createBillingProvider(parseServerEnv({})).kind).toBe('mock')
  })
})
