import { describe, it, expect } from 'vitest'
import { parseServerEnv, secretStatus, parseEgressAllowlist } from './env'

describe('serverEnv', () => {
  it('applies safe defaults when secrets are absent', () => {
    const env = parseServerEnv({})
    expect(env.NODE_ENV).toBe('development')
    expect(env.SANDBOX_PROVIDER).toBe('mock')
    expect(env.SPEND_CAP_USER_USD).toBe(5)
    expect(env.SPEND_CAP_GLOBAL_USD).toBe(100)
    expect(secretStatus(env).openrouter).toBe(false)
    expect(secretStatus(env).supabase).toBe(false)
  })

  it('coerces numeric values and reflects provided secrets', () => {
    const env = parseServerEnv({
      PORT: '9000',
      OPENROUTER_API_KEY: 'sk-test',
      SUPABASE_URL: 'https://x.supabase.co',
      SUPABASE_ANON_KEY: 'anon',
      SUPABASE_SERVICE_ROLE_KEY: 'svc',
    } as NodeJS.ProcessEnv)
    expect(env.PORT).toBe(9000)
    expect(secretStatus(env).openrouter).toBe(true)
    expect(secretStatus(env).supabase).toBe(true)
    expect(secretStatus(env).stripe).toBe(false)
  })

  it('rejects an invalid SUPABASE_URL', () => {
    expect(() =>
      parseServerEnv({ SUPABASE_URL: 'not-a-url' } as NodeJS.ProcessEnv),
    ).toThrow()
  })

  it('parses a comma-separated egress allowlist into clean domains', () => {
    const env = parseServerEnv({
      EGRESS_ALLOWLIST: 'registry.npmjs.org, , pypi.org ,docs.example.com',
    } as NodeJS.ProcessEnv)
    expect(parseEgressAllowlist(env)).toEqual([
      'registry.npmjs.org',
      'pypi.org',
      'docs.example.com',
    ])
  })

  it('defaults the egress allowlist to empty (default-deny)', () => {
    expect(parseEgressAllowlist(parseServerEnv({}))).toEqual([])
  })
})
