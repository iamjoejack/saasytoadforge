import { describe, it, expect } from 'vitest'
import { hostFromUrl, isDomainAllowed } from './egress'

describe('hostFromUrl', () => {
  it('extracts the hostname with or without a scheme', () => {
    expect(hostFromUrl('https://registry.npmjs.org/pkg')).toBe('registry.npmjs.org')
    expect(hostFromUrl('evil.com/x')).toBe('evil.com')
  })
})

describe('isDomainAllowed', () => {
  it('denies everything when the allowlist is empty (default-deny)', () => {
    expect(isDomainAllowed('registry.npmjs.org', [])).toBe(false)
  })

  it('allows exact matches and subdomains only', () => {
    const allow = ['registry.npmjs.org', 'pypi.org']
    expect(isDomainAllowed('registry.npmjs.org', allow)).toBe(true)
    expect(isDomainAllowed('files.pypi.org', allow)).toBe(true)
    expect(isDomainAllowed('evil.com', allow)).toBe(false)
    expect(isDomainAllowed('notpypi.org', allow)).toBe(false)
  })
})
