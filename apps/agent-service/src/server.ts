import Fastify, { type FastifyInstance } from 'fastify'

/**
 * Builds the agent-service HTTP app. Kept as a factory so tests can drive it via
 * `app.inject` without binding a port. Websocket + agent-loop routes land in
 * later phases; Phase 0 ships a health surface only.
 */
export function buildServer(): FastifyInstance {
  const app = Fastify({ logger: false })

  app.get('/health', async () => ({
    status: 'ok',
    service: 'agent-service',
  }))

  return app
}
