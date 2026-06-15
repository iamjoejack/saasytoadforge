import { describe, it, expect } from 'vitest'
import { DevAuthProvider } from './dev-provider'
import { AuthError } from './types'

describe('DevAuthProvider', () => {
  it('signs up, issues a session, and resolves it', async () => {
    const auth = new DevAuthProvider()
    const session = await auth.signUp('me@forge.dev', 'password123')
    expect(session.user.email).toBe('me@forge.dev')
    expect(session.token).toBeTruthy()
    expect((await auth.getSession(session.token))?.email).toBe('me@forge.dev')
  })

  it('rejects weak or invalid credentials', async () => {
    const auth = new DevAuthProvider()
    await expect(auth.signUp('bad', 'password123')).rejects.toBeInstanceOf(AuthError)
    await expect(auth.signUp('ok@forge.dev', 'short')).rejects.toBeInstanceOf(AuthError)
  })

  it('rejects a duplicate email', async () => {
    const auth = new DevAuthProvider()
    await auth.signUp('dup@forge.dev', 'password123')
    await expect(auth.signUp('dup@forge.dev', 'password123')).rejects.toThrow(/already exists/)
  })

  it('signs in with the right password and rejects the wrong one', async () => {
    const auth = new DevAuthProvider()
    await auth.signUp('user@forge.dev', 'password123')
    expect((await auth.signIn('user@forge.dev', 'password123')).user.email).toBe('user@forge.dev')
    await expect(auth.signIn('user@forge.dev', 'wrongpass1')).rejects.toThrow(/invalid/)
  })

  it('clears a session on sign out', async () => {
    const auth = new DevAuthProvider()
    const session = await auth.signUp('out@forge.dev', 'password123')
    await auth.signOut(session.token)
    expect(await auth.getSession(session.token)).toBeNull()
  })
})
