import { describe, it, expect } from 'vitest'
import { buildServer } from './server'

describe('agent-service health', () => {
  it('responds ok on /health', async () => {
    const app = buildServer()
    const res = await app.inject({ method: 'GET', url: '/health' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ status: 'ok', service: 'agent-service' })
    await app.close()
  })
})

describe('protected routes', () => {
  it('rejects unauthenticated REST calls with 401', async () => {
    const app = buildServer()
    const ws = await app.inject({ method: 'GET', url: '/workspaces' })
    expect(ws.statusCode).toBe(401)
    const admin = await app.inject({ method: 'GET', url: '/admin/stats' })
    expect(admin.statusCode).toBe(401)
    await app.close()
  })
})

describe('stripe webhook', () => {
  // The webhook is public to the auth hook (Stripe sends no Bearer token) but must
  // reject anything without a valid signature, so it never grants credit on a forged event.
  it('reaches the handler and rejects a missing signature with 400, not 401', async () => {
    const app = buildServer()
    const res = await app.inject({
      method: 'POST',
      url: '/webhooks/stripe',
      headers: { 'content-type': 'application/json' },
      payload: { type: 'checkout.session.completed' },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json()).toEqual({ error: 'missing signature or body' })
    await app.close()
  })
})
