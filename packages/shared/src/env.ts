import { z } from 'zod'

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
  return serverEnvSchema.parse(raw)
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
