/**
 * Back-office role stamped on the identity provider account (Supabase app_metadata
 * forge_role). Set only by owner bootstrap/reclaim in the admin store, which requires
 * OWNER_SETUP_SECRET. Membership in the public OWNER_EMAILS list is NOT enough.
 */
export type ForgeRole = 'owner' | 'admin'

export interface AuthUser {
  id: string
  email: string
  /**
   * The stamped back-office role, or null for an ordinary customer. Owner power (spend-cap
   * bypass, platform billing) keys off this, never off the email string alone.
   */
  forgeRole: ForgeRole | null
}

export interface Session {
  token: string
  user: AuthUser
}

export interface AuthProvider {
  signUp(email: string, password: string): Promise<Session>
  signIn(email: string, password: string): Promise<Session>
  signOut(token: string): Promise<void>
  getSession(token: string | undefined): Promise<AuthUser | null>
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthError'
  }
}
