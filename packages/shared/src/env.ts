import { z } from 'zod'

/** Shared secret between the web app and agent-service for signed user tokens. */
export const DEFAULT_AGENT_SERVICE_SECRET = 'forge-dev-insecure-secret-change-in-prod'

/**
 * Server-side configuration. Secret values are OPTIONAL at boot so the app runs
 * with mock providers in development and never hard-blocks (see DECISIONS.md).
 * Secrets are required only when their feature is actually exercised.
 */
export const serverEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(8787),

  // Secrets (optional at boot; features degrade to mocks when absent).
  OPENROUTER_API_KEY: z.string().optional(),
  E2B_API_KEY: z.string().optional(),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),

  // Shared secret for web <-> agent-service signed tokens.
  AGENT_SERVICE_SECRET: z.string().default(DEFAULT_AGENT_SERVICE_SECRET),
  /** Allowed browser origin(s) for CORS + websocket, comma-separated. Empty = localhost dev. */
  ALLOWED_ORIGINS: z.string().default(''),

  // Sandbox + egress safety.
  SANDBOX_PROVIDER: z.enum(['mock', 'e2b', 'daytona']).default('mock'),
  /** Comma-separated egress allowlist applied to every sandbox (default-deny). */
  EGRESS_ALLOWLIST: z.string().default(''),

  // Spend control (USD).
  SPEND_CAP_USER_USD: z.coerce.number().nonnegative().default(5),
  SPEND_CAP_GLOBAL_USD: z.coerce.number().nonnegative().default(100),

  // Model routing. Overridable via env, never hardcoded in business logic.
  MODEL_FAST: z.string().default('openai/gpt-4o-mini'),
  MODEL_FRONTIER: z.string().default('anthropic/claude-sonnet-4'),
  MODEL_DEEP: z.string().default('openrouter/fusion'),
})

export type ServerEnv = z.infer<typeof serverEnvSchema>

export function parseServerEnv(raw: NodeJS.ProcessEnv = process.env): ServerEnv {
  // Treat empty-string env vars (common in .env files) as unset so optional fields work.
  const cleaned: Record<string, string | undefined> = {}
  for (const [key, value] of Object.entries(raw)) {
    cleaned[key] = value === '' ? undefined : value
  }
  const env = serverEnvSchema.parse(cleaned)

  // Refuse to boot with the public dev secret in production - it would let anyone forge
  // a token for any user and defeat tenant isolation.
  if (env.NODE_ENV === 'production') {
    if (env.AGENT_SERVICE_SECRET === DEFAULT_AGENT_SERVICE_SECRET) {
      throw new Error(
        'AGENT_SERVICE_SECRET must be set to a strong, unique value in production (the default is public).',
      )
    }
    if (env.ALLOWED_ORIGINS.trim() === '') {
      console.warn(
        '[env] ALLOWED_ORIGINS is empty in production; CORS will reject the deployed web app. Set it to the web origin.',
      )
    }
  }
  return env
}

export interface SecretStatus {
  openrouter: boolean
  e2b: boolean
  supabase: boolean
  stripe: boolean
}

/** Which secret-backed features are live vs running on mocks. */
export function secretStatus(env: ServerEnv): SecretStatus {
  return {
    openrouter: Boolean(env.OPENROUTER_API_KEY),
    e2b: Boolean(env.E2B_API_KEY),
    supabase: Boolean(
      env.SUPABASE_URL && env.SUPABASE_ANON_KEY && env.SUPABASE_SERVICE_ROLE_KEY,
    ),
    stripe: Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET),
  }
}

/** Parse the comma-separated allowlist into a clean domain array. */
export function parseEgressAllowlist(env: ServerEnv): string[] {
  return env.EGRESS_ALLOWLIST.split(',')
    .map((d) => d.trim())
    .filter((d) => d.length > 0)
}
