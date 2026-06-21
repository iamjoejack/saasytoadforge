import { NextResponse } from 'next/server'
import { mintAgentToken } from '@forge/shared'
import { currentUser } from '@/lib/auth/server'
import { requireAgentSecret } from '@/lib/agent-secret'

/** Mints a short-lived signed token for the agent-service, scoped to the logged-in user. */
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
  return NextResponse.json({ token: mintAgentToken(user.id, secret, 3600, Date.now(), user.email) })
}
