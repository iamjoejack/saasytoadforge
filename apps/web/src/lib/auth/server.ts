import { cookies } from 'next/headers'
import type { AuthProvider, AuthUser } from './types'
import { DevAuthProvider } from './dev-provider'
import { SESSION_COOKIE } from './constants'

let provider: AuthProvider | null = null

/** The active auth provider. Supabase Auth drops in here when SUPABASE_* is configured. */
export function getAuthProvider(): AuthProvider {
  provider ??= new DevAuthProvider()
  return provider
}

export async function currentUser(): Promise<AuthUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  return getAuthProvider().getSession(token)
}

export { SESSION_COOKIE }
