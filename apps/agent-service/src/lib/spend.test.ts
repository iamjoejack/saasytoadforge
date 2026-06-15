import { describe, it, expect } from 'vitest'
import { SpendLedger, costForTokens, type SpendCaps } from './spend'

const CAPS: SpendCaps = { perUserUsd: 5, globalUsd: 100 }

describe('costForTokens', () => {
  it('uses the per-model rate', () => {
    expect(costForTokens('openai/gpt-4o-mini', 1_000_000)).toBeCloseTo(0.3)
    expect(costForTokens('unknown/model', 1_000_000)).toBeCloseTo(5)
  })
})

describe('SpendLedger', () => {
  it('accumulates per-user and global spend', () => {
    const ledger = new SpendLedger()
    ledger.record('u1', 1)
    ledger.record('u1', 0.5)
    ledger.record('u2', 2)
    expect(ledger.userSpend('u1')).toBeCloseTo(1.5)
    expect(ledger.globalSpend()).toBeCloseTo(3.5)
  })

  it('blocks a call that would exceed the per-user cap', () => {
    const ledger = new SpendLedger()
    ledger.record('u1', 4.8)
    expect(ledger.check('u1', 0.1, CAPS).allowed).toBe(true)
    const blocked = ledger.check('u1', 0.5, CAPS)
    expect(blocked.allowed).toBe(false)
    expect(blocked.reason).toMatch(/per-user/)
  })

  it('blocks a call that would exceed the global cap', () => {
    const ledger = new SpendLedger()
    ledger.record('u1', 99.9)
    expect(ledger.check('u2', 0.5, CAPS).allowed).toBe(false)
  })

  it('reports remaining budget in the summary', () => {
    const ledger = new SpendLedger()
    ledger.record('u1', 2)
    const summary = ledger.summary('u1', CAPS)
    expect(summary.userRemainingUsd).toBeCloseTo(3)
    expect(summary.globalRemainingUsd).toBeCloseTo(98)
  })
})
