import { NextResponse } from 'next/server'
import { mintAgentToken, DEFAULT_AGENT_SERVICE_SECRET } from '@forge/shared'
import { currentUser } from '@/lib/auth/server'

export async function POST(req: Request) {
  const user = await currentUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: { planId?: unknown }
  try {
    body = (await req.json()) as { planId?: unknown }
  } catch {
    return NextResponse.json({ error: 'invalid request body' }, { status: 400 })
  }

  if (typeof body.planId !== 'string') {
    return NextResponse.json({ error: 'planId is required' }, { status: 400 })
  }

  const secret = process.env.AGENT_SERVICE_SECRET ?? DEFAULT_AGENT_SERVICE_SECRET
  const token = mintAgentToken(user.id, secret)

  const agentServiceUrl = process.env.NEXT_PUBLIC_AGENT_SERVICE_URL ?? 'http://localhost:8787'

  try {
    const res = await fetch(`${agentServiceUrl}/billing/checkout`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        planId: body.planId,
        email: user.email,
      }),
    })

    if (!res.ok) {
      const errBody = (await res.json().catch(() => ({}))) as { error?: string }
      return NextResponse.json(
        { error: errBody.error ?? 'failed to create checkout session' },
        { status: res.status },
      )
    }

    const data = (await res.json()) as { url: string; mode: 'mock' | 'stripe' }
    return NextResponse.json(data)
  } catch (err) {
    console.error('Checkout error:', err)
    return NextResponse.json({ error: 'could not reach the billing service' }, { status: 502 })
  }
}
