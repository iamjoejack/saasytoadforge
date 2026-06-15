import { describe, it, expect } from 'vitest'
import {
  parseServerEnv,
  secretStatus,
  parseEgressAllowlist,
  DEFAULT_AGENT_SERVICE_SECRET,
} from './env'

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

  it('refuses the public default AGENT_SERVICE_SECRET in production', () => {
    expect(() => parseServerEnv({ NODE_ENV: 'production' } as NodeJS.ProcessEnv)).toThrow(
      /AGENT_SERVICE_SECRET/,
    )
    expect(() =>
      parseServerEnv({
        NODE_ENV: 'production',
        AGENT_SERVICE_SECRET: DEFAULT_AGENT_SERVICE_SECRET,
      } as NodeJS.ProcessEnv),
    ).toThrow(/AGENT_SERVICE_SECRET/)
  })

  it('accepts a custom secret in production', () => {
    const env = parseServerEnv({
      NODE_ENV: 'production',
      AGENT_SERVICE_SECRET: 'a-strong-unique-secret',
      ALLOWED_ORIGINS: 'https://forge.example.com',
    } as NodeJS.ProcessEnv)
    expect(env.AGENT_SERVICE_SECRET).toBe('a-strong-unique-secret')
  })
})
