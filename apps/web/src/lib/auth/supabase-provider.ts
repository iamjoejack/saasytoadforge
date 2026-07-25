import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { AuthProvider, AuthUser, ForgeRole, Session } from './types'
import { AuthError } from './types'

/**
 * Reads the back-office role stamped in Supabase app_metadata. app_metadata is writable
 * only with the service-role key (the admin store's bootstrap/reclaim path), never by the
 * user, so it is safe to trust here. Anything else, including a user-supplied user_metadata
 * role, is ignored.
 */
export function readForgeRole(appMetadata: unknown): ForgeRole | null {
  const role = (appMetadata as { forge_role?: unknown } | null | undefined)?.forge_role
  return role === 'owner' || role === 'admin' ? role : null
}

export class SupabaseAuthProvider implements AuthProvider {
  private supabase: SupabaseClient

  constructor(supabaseUrl: string, supabaseAnonKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseAnonKey)
  }

  async signUp(email: string, password: string): Promise<Session> {
    const { data, error } = await this.supabase.auth.signUp({ email, password })
    if (error) throw new AuthError(error.message)
    if (!data.session || !data.user) throw new AuthError('Sign up succeeded but session missing.')

    return {
      token: data.session.access_token,
      user: {
        id: data.user.id,
        email: data.user.email ?? '',
        forgeRole: readForgeRole(data.user.app_metadata),
      },
    }
  }

  async signIn(email: string, password: string): Promise<Session> {
    const { data, error } = await this.supabase.auth.signInWithPassword({ email, password })
    if (error) throw new AuthError(error.message)
    if (!data.session || !data.user) throw new AuthError('Sign in succeeded but session missing.')

    return {
      token: data.session.access_token,
      user: {
        id: data.user.id,
        email: data.user.email ?? '',
        forgeRole: readForgeRole(data.user.app_metadata),
      },
    }
  }

  async signOut(_token: string): Promise<void> {
    // If we only have the access token, signOut requires the user to be active in the client instance.
    // In a stateless scenario, we might just clear the cookie on the client side, but we can call it.
    await this.supabase.auth.signOut()
  }

  async getSession(token: string | undefined): Promise<AuthUser | null> {
    if (!token) return null
    const { data, error } = await this.supabase.auth.getUser(token)
    if (error || !data.user) return null
    return {
      id: data.user.id,
      email: data.user.email ?? '',
      forgeRole: readForgeRole(data.user.app_metadata),
    }
  }
}
