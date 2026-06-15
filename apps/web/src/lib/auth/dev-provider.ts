import { randomUUID, scryptSync, randomBytes, timingSafeEqual } from 'node:crypto'
import type { AuthProvider, AuthUser, Session } from './types'
import { AuthError } from './types'

interface StoredUser {
  id: string
  email: string
  salt: string
  hash: string
}

function hashPassword(password: string, salt: string): string {
  return scryptSync(password, salt, 64).toString('hex')
}

/**
 * In-memory auth for local development. Real identity is Supabase Auth (drop-in behind
 * the AuthProvider interface). Passwords are salted + scrypt-hashed; sessions are opaque
 * tokens. State lives in this process only - persistence comes with Supabase.
 */
export class DevAuthProvider implements AuthProvider {
  private readonly users = new Map<string, StoredUser>()
  private readonly sessions = new Map<string, AuthUser>()

  async signUp(email: string, password: string): Promise<Session> {
    const key = email.toLowerCase().trim()
    if (!key.includes('@') || password.length < 8) {
      throw new AuthError('enter a valid email and a password of at least 8 characters')
    }
    if (this.users.has(key)) throw new AuthError('an account with that email already exists')
    const salt = randomBytes(16).toString('hex')
    const user: StoredUser = { id: randomUUID(), email: key, salt, hash: hashPassword(password, salt) }
    this.users.set(key, user)
    return this.createSession(user)
  }

  async signIn(email: string, password: string): Promise<Session> {
    const user = this.users.get(email.toLowerCase().trim())
    if (!user) throw new AuthError('invalid email or password')
    const candidate = Buffer.from(hashPassword(password, user.salt))
    const expected = Buffer.from(user.hash)
    if (candidate.length !== expected.length || !timingSafeEqual(candidate, expected)) {
      throw new AuthError('invalid email or password')
    }
    return this.createSession(user)
  }

  async signOut(token: string): Promise<void> {
    this.sessions.delete(token)
  }

  async getSession(token: string | undefined): Promise<AuthUser | null> {
    if (!token) return null
    return this.sessions.get(token) ?? null
  }

  private createSession(user: StoredUser): Session {
    const authUser: AuthUser = { id: user.id, email: user.email }
    const token = randomUUID()
    this.sessions.set(token, authUser)
    return { token, user: authUser }
  }
}
