import { describe, it, expect } from 'vitest'
import { redact, logLine } from './logger'

describe('redact', () => {
  it('redacts secret-looking keys', () => {
    expect(redact({ apiKey: 'abc', authorization: 'Bearer x', name: 'forge' })).toEqual({
      apiKey: '[redacted]',
      authorization: '[redacted]',
      name: 'forge',
    })
  })

  it('redacts inline secret-looking values in strings', () => {
    expect(redact('using sk-abcdef123456 now')).toBe('using [redacted] now')
  })

  it('recurses into nested objects and arrays', () => {
    expect(redact({ a: { token: 't' }, b: [{ secret: 's' }] })).toEqual({
      a: { token: '[redacted]' },
      b: [{ secret: '[redacted]' }],
    })
  })
})

describe('logLine', () => {
  it('emits structured json with no raw secrets', () => {
    const line = logLine('info', 'agent run', { userId: 'u1', token: 'sk-secret123' })
    const parsed = JSON.parse(line) as Record<string, unknown>
    expect(parsed.level).toBe('info')
    expect(parsed.msg).toBe('agent run')
    expect(parsed.userId).toBe('u1')
    expect(parsed.token).toBe('[redacted]')
    expect(line).not.toContain('sk-secret123')
  })
})
