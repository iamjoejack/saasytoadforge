import { NextResponse } from 'next/server'
import { mintAgentToken } from '@forge/shared'
import { currentUser } from '@/lib/auth/server'
import { requireAgentSecret } from '@/lib/agent-secret'

/**
 * Mints a short-lived signed token for the agent-service, scoped to the logged-in user.
 *
 * The email claim is a PRIVILEGE claim, not an identity one: the agent-service grants the
 * spend-cap bypass on isOwnerEmail(claims.email) and platform billing on isAdminEmail. So it
 * rides along only for an account carrying a stamped back-office role. Otherwise anyone could
 * sign up through the ordinary customer flow with a published OWNER_EMAILS address and inherit
 * uncapped model spend. Workspace scoping keys off userId and is unaffected.
 */
export async function GET() {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  let secret: string
  try {
    secret = requireAgentSecret()
  } catch {
    return NextResponse.json(
      { error: 'server misconfigured: AGENT_SERVICE_SECRET' },
      { status: 500 },
    )
  }
  const privilegedEmail = user.forgeRole ? user.email : undefined
  return NextResponse.json({
    token: mintAgentToken(user.id, secret, 3600, Date.now(), privilegedEmail),
  })
}
