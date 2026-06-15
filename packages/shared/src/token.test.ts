import { describe, it, expect } from 'vitest'
import { mintAgentToken, verifyAgentToken } from './token'

const SECRET = 'test-secret'

describe('agent token', () => {
  it('round-trips a valid token to its claims', () => {
    const token = mintAgentToken('user-1', SECRET)
    const claims = verifyAgentToken(token, SECRET)
    expect(claims?.userId).toBe('user-1')
  })

  it('rejects a token signed with a different secret', () => {
    const token = mintAgentToken('user-1', SECRET)
    expect(verifyAgentToken(token, 'other-secret')).toBeNull()
  })

  it('rejects a tampered payload', () => {
    const token = mintAgentToken('user-1', SECRET)
    const tampered = mintAgentToken('attacker', SECRET).split('.')[0] + '.' + token.split('.')[1]
    expect(verifyAgentToken(tampered, SECRET)).toBeNull()
  })

  it('rejects an expired token', () => {
    const past = Date.now() - 10_000
    const token = mintAgentToken('user-1', SECRET, 1, past)
    expect(verifyAgentToken(token, SECRET)).toBeNull()
  })

  it('rejects garbage', () => {
    expect(verifyAgentToken('not-a-token', SECRET)).toBeNull()
    expect(verifyAgentToken('', SECRET)).toBeNull()
  })
})
