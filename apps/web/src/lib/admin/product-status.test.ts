import { describe, it, expect, beforeEach } from 'vitest'
import {
  isValidStatus,
  getProductStatus,
  setProductStatus,
  DEFAULT_STATUS,
  PRODUCT_STATUSES,
} from './product-status'

// Force the in-memory path (no Supabase) so the test is hermetic.
beforeEach(() => {
  delete process.env.SUPABASE_URL
  delete process.env.SUPABASE_SERVICE_ROLE_KEY
})

describe('product status', () => {
  it('validates status values', () => {
    for (const s of PRODUCT_STATUSES) expect(isValidStatus(s)).toBe(true)
    expect(isValidStatus('bogus')).toBe(false)
    expect(isValidStatus(42)).toBe(false)
    expect(isValidStatus(undefined)).toBe(false)
  })

  it('defaults to coming-soon and round-trips in memory without Supabase', async () => {
    expect(await getProductStatus()).toBe(DEFAULT_STATUS)
    await setProductStatus('live')
    expect(await getProductStatus()).toBe('live')
    await setProductStatus('early-access')
    expect(await getProductStatus()).toBe('early-access')
  })
})
