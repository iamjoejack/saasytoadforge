import type { SandboxProvider, ServerEnv } from '@forge/shared'
import { MockSandboxProvider } from './mock-provider'
import { E2BSandboxProvider } from './e2b-provider'

export { MockSandboxProvider } from './mock-provider'
export { E2BSandboxProvider } from './e2b-provider'

/**
 * Resolves the configured SandboxProvider. Callers depend only on the interface, so
 * swapping providers never touches business logic.
 *
 * E2B (microVM) and Daytona (gVisor) are the real isolation boundaries; they land as
 * soon as their credentials are supplied. Until then we degrade to the in-memory mock
 * so the rest of the system keeps building (never hard-block).
 */
export function createSandboxProvider(env: ServerEnv): SandboxProvider {
  switch (env.SANDBOX_PROVIDER) {
    case 'e2b':
      if (!env.E2B_API_KEY) {
        console.warn('[sandbox] SANDBOX_PROVIDER=e2b but E2B_API_KEY missing; using mock provider')
        return new MockSandboxProvider()
      }
      return new E2BSandboxProvider(env.E2B_API_KEY)
    case 'daytona':
      // TODO(phase1+): return new DaytonaSandboxProvider(env)
      console.warn('[sandbox] Daytona provider not yet implemented; using mock provider')
      return new MockSandboxProvider()
    case 'mock':
      return new MockSandboxProvider()
  }
}
