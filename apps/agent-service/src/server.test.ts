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
