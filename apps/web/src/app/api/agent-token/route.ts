import { NextResponse } from 'next/server'
import { mintAgentToken, DEFAULT_AGENT_SERVICE_SECRET } from '@forge/shared'
import { currentUser } from '@/lib/auth/server'

/** Mints a short-lived signed token for the agent-service, scoped to the logged-in user. */
export async function GET() {
  const user = await currentUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const secret = process.env.AGENT_SERVICE_SECRET ?? DEFAULT_AGENT_SERVICE_SECRET
  // Never mint tokens with the public dev secret in production.
  if (process.env.NODE_ENV === 'production' && secret === DEFAULT_AGENT_SERVICE_SECRET) {
    return NextResponse.json({ error: 'server misconfigured: AGENT_SERVICE_SECRET' }, { status: 500 })
  }
  return NextResponse.json({ token: mintAgentToken(user.id, secret) })
}
