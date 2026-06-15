import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Tiny signed token (HMAC-SHA256) the web mints server-side for the logged-in user and
 * the agent-service verifies on every request. The secret stays server-side; the browser
 * only ever holds the signed token. This closes the cross-tenant gap where the browser
 * talks to the agent-service directly. (Server-only module - never imported client-side.)
 */
export interface TokenClaims {
  userId: string
  exp: number
}

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url')
}

export function mintAgentToken(
  userId: string,
  secret: string,
  ttlSeconds = 3600,
  nowMs: number = Date.now(),
): string {
  const claims: TokenClaims = { userId, exp: Math.floor(nowMs / 1000) + ttlSeconds }
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url')
  return `${payload}.${sign(payload, secret)}`
}

export function verifyAgentToken(
  token: string,
  secret: string,
  nowMs: number = Date.now(),
): TokenClaims | null {
  const dot = token.indexOf('.')
  if (dot === -1) return null
  const payload = token.slice(0, dot)
  const provided = Buffer.from(token.slice(dot + 1))
  const expected = Buffer.from(sign(payload, secret))
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString()) as TokenClaims
    if (typeof claims.userId !== 'string' || typeof claims.exp !== 'number') return null
    if (claims.exp < Math.floor(nowMs / 1000)) return null
    return claims
  } catch {
    return null
  }
}
