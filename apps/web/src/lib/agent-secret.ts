import { DEFAULT_AGENT_SERVICE_SECRET } from '@forge/shared'

/**
 * The shared web-to-agent-service signing secret. Refuses the public dev default in
 * production so a misconfigured deploy can never sign tokens with a publicly known key (a
 * forged token grants owner/admin powers in the agent-service). Centralized so every
 * token-minting route enforces it identically and the three cannot drift.
 */
export function requireAgentSecret(): string {
  const secret = process.env.AGENT_SERVICE_SECRET ?? DEFAULT_AGENT_SERVICE_SECRET
  if (process.env.NODE_ENV === 'production' && secret === DEFAULT_AGENT_SERVICE_SECRET) {
    throw new Error('AGENT_SERVICE_SECRET must be set to a non-default value in production')
  }
  return secret
}
