import { NextResponse } from 'next/server'
import { mintAgentToken, DEFAULT_AGENT_SERVICE_SECRET } from '@forge/shared'
import { currentAdmin } from '@/lib/admin/server'

/**
 * Owner/admin view of platform billing + usage. Gated by the admin session, then proxied
 * to the agent-service with a freshly minted token for the admin's email. The agent-service
 * still enforces its own ADMIN_EMAILS allowlist, so owners always pass.
 */
export async function GET() {
  const admin = await currentAdmin()
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (admin.role !== 'owner' && !admin.permissions.includes('billing')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  const secret = process.env.AGENT_SERVICE_SECRET || DEFAULT_AGENT_SERVICE_SECRET
  const token = mintAgentToken(admin.email, secret, 3600, Date.now(), admin.email)
  const base = process.env.NEXT_PUBLIC_AGENT_SERVICE_URL || 'http://localhost:8787'
  try {
    const res = await fetch(`${base}/admin/stats`, { headers: { authorization: `Bearer ${token}` } })
    if (!res.ok) {
      return NextResponse.json(
        { error: 'Live billing needs an owner account, or your email added to ADMIN_EMAILS.' },
        { status: 502 },
      )
    }
    return NextResponse.json(await res.json())
  } catch {
    return NextResponse.json({ error: 'The agent service is not reachable.' }, { status: 502 })
  }
}
