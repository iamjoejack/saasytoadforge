import crypto from 'node:crypto'
import type { AdminRole, AreaKey } from './permissions'
import { sanitizeAreas } from './permissions'

/** Separate from the customer session cookie (forge_session). httpOnly. */
export const ADMIN_COOKIE = 'forge_admin'

/** Admin sessions are short-lived; re-login is cheap and limits blast radius. */
export const ADMIN_SESSION_TTL_MS = 1000 * 60 * 60 * 8 // 8 hours

export interface AdminClaims {
  email: string
  role: AdminRole
  permissions: AreaKey[]
  /** Expiry, ms since epoch. */
  exp: number
}

const DEV_KEY = 'forge-admin-dev-insecure-secret-change-in-prod'

/**
 * Signing key for admin session cookies. Prefer a dedicated ADMIN_SESSION_SECRET. Otherwise
 * derive a domain-separated key from another server-only secret, so a leak of the agent-token
 * secret does NOT also forge admin cookies (the label keeps the two key spaces distinct).
 * Fails closed in production when no real secret is available; the dev literal is dev-only.
 */
function signingKey(): string {
  const explicit = process.env.ADMIN_SESSION_SECRET
  if (explicit) return explicit
  const agentSecret = process.env.AGENT_SERVICE_SECRET
  if (agentSecret) return crypto.createHash('sha256').update(`forge-admin-session:${agentSecret}`).digest('hex')
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (svc) return crypto.createHash('sha256').update(`forge-admin-session:${svc}`).digest('hex')
  if (process.env.NODE_ENV === 'production') {
    throw new Error('ADMIN_SESSION_SECRET must be set in production; refusing to sign admin sessions with a public key.')
  }
  return DEV_KEY
}

function hmac(payload: string): string {
  return crypto.createHmac('sha256', signingKey()).update(payload).digest('base64url')
}

/** Constant-time compare that tolerates differing lengths without throwing. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return crypto.timingSafeEqual(ab, bb)
}

export function signAdminSession(claims: AdminClaims): string {
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url')
  return `${payload}.${hmac(payload)}`
}

export function verifyAdminSession(token: string | undefined | null): AdminClaims | null {
  if (!token) return null
  const dot = token.lastIndexOf('.')
  if (dot <= 0) return null
  const payload = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  let claims: AdminClaims
  try {
    // signingKey() throws in a misconfigured production deploy; treat that as no session.
    if (!safeEqual(sig, hmac(payload))) return null
    claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as AdminClaims
  } catch {
    return null
  }
  if (
    typeof claims.email !== 'string' ||
    (claims.role !== 'owner' && claims.role !== 'admin') ||
    typeof claims.exp !== 'number' ||
    claims.exp < Date.now()
  ) {
    return null
  }
  return { email: claims.email, role: claims.role, permissions: sanitizeAreas(claims.permissions), exp: claims.exp }
}
