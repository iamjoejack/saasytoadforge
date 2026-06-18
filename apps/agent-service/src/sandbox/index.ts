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
      // Real execution whenever a key is available: an E2B key alone upgrades the default
      // mock to a real microVM, so users get real builds, tests, and deploys without also
      // having to flip SANDBOX_PROVIDER. No key means we stay quietly on the mock.
      if (env.E2B_API_KEY) {
        console.info('[sandbox] E2B_API_KEY present; using the real E2B sandbox.')
        return new E2BSandboxProvider(env.E2B_API_KEY)
      }
      return new MockSandboxProvider()
  }
}
