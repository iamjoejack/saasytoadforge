export interface AuthUser {
  id: string
  email: string
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
