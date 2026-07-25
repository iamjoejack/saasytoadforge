import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import { mintAgentToken, verifyAgentToken, isOwnerEmail, isAdminEmail } from '@forge/shared'
import { OWNER_EMAILS } from '@forge/shared/owners'
import { DevAuthProvider } from './dev-provider'
import { readForgeRole } from './supabase-provider'

/**
 * Owner power on the agent-service is granted from the token's email claim:
 * isOwnerEmail(claims.email) bypasses every spend cap, isAdminEmail(claims.email) opens
 * platform billing. OWNER_EMAILS is a published list in the repo, and anyone can sign up
 * through the ordinary customer flow. So the email claim must ride along only for an account
 * carrying a back-office role stamped by the admin store (service-role only), never for one
 * that merely typed a matching address at signup.
 */
describe('forge role is the authority for owner power, not the email string', () => {
  const SECRET = 'test-secret'
  const ownerEmail = OWNER_EMAILS[0] ?? 'owner@forge.dev'

  it('reads a stamped role and ignores anything else', () => {
    expect(readForgeRole({ forge_role: 'owner' })).toBe('owner')
    expect(readForgeRole({ forge_role: 'admin' })).toBe('admin')
    expect(readForgeRole({ forge_role: 'superuser' })).toBeNull()
    expect(readForgeRole({})).toBeNull()
    expect(readForgeRole(null)).toBeNull()
    expect(readForgeRole(undefined)).toBeNull()
  })

  it('a customer signup with an owner email carries no owner power', async () => {
    const auth = new DevAuthProvider()
    const squatter = await auth.signUp(ownerEmail, 'password123')
    expect(squatter.user.forgeRole).toBeNull()

    // What the agent-token route mints for an unstamped account.
    const email = squatter.user.forgeRole ? squatter.user.email : undefined
    const claims = verifyAgentToken(
      mintAgentToken(squatter.user.id, SECRET, 3600, Date.now(), email),
      SECRET,
    )

    expect(claims?.userId).toBe(squatter.user.id)
    expect(claims?.email).toBeUndefined()
    expect(isOwnerEmail(claims?.email, OWNER_EMAILS.join(','))).toBe(false)
    expect(isAdminEmail(claims?.email, OWNER_EMAILS.join(','))).toBe(false)
  })

  it('a stamped owner still gets the claim, so the bypass keeps working', () => {
    const email = readForgeRole({ forge_role: 'owner' }) ? ownerEmail : undefined
    const claims = verifyAgentToken(
      mintAgentToken('user-1', SECRET, 3600, Date.now(), email),
      SECRET,
    )
    expect(claims?.email).toBe(ownerEmail)
    expect(isOwnerEmail(claims?.email, OWNER_EMAILS.join(','))).toBe(true)
  })

  it('the mint route gates the email claim on forgeRole', () => {
    // Structural: the route must never pass user.email straight into mintAgentToken.
    const src = readFileSync(join(__dirname, '../../app/api/agent-token/route.ts'), 'utf8')
    expect(src).toMatch(/user\.forgeRole\s*\?\s*user\.email\s*:\s*undefined/)
    expect(src).not.toMatch(/mintAgentToken\([^)]*user\.email/)
  })

  it('the session route reports back-office access from forgeRole, not the email list', () => {
    const src = readFileSync(join(__dirname, '../../app/api/auth/session/route.ts'), 'utf8')
    expect(src).toMatch(/user\.forgeRole\s*!==\s*null/)
    // Importing the email matcher here would mean the old email-string check came back.
    expect(src).not.toMatch(/isAdminEmail/)
  })
})
