import { describe, it, expect, beforeAll } from 'vitest'

// Deterministic owner list for the store tests.
beforeAll(() => {
  process.env.OWNER_EMAILS = 'owner@forge.dev'
})

import {
  effectivePermissions,
  sanitizeAreas,
  canAccess,
  canManageAdmins,
  ALL_AREAS,
} from './permissions'
import { signAdminSession, verifyAdminSession } from './session'
import { InMemoryAdminStore, isOwner } from './store'

describe('permissions', () => {
  it('owners get every area; admins get their granted subset', () => {
    expect(effectivePermissions('owner', [])).toEqual(ALL_AREAS)
    expect(effectivePermissions('admin', ['billing'])).toEqual(['billing'])
  })

  it('drops invalid area keys', () => {
    expect(sanitizeAreas(['billing', 'nope', 42, 'users'])).toEqual(['billing', 'users'])
    expect(sanitizeAreas('not-an-array')).toEqual([])
  })

  it('owners can access anything; admins only their areas', () => {
    expect(canAccess({ role: 'owner', permissions: [] }, 'system')).toBe(true)
    expect(canAccess({ role: 'admin', permissions: ['billing'] }, 'billing')).toBe(true)
    expect(canAccess({ role: 'admin', permissions: ['billing'] }, 'system')).toBe(false)
  })

  it('only owners can manage admins', () => {
    expect(canManageAdmins('owner')).toBe(true)
    expect(canManageAdmins('admin')).toBe(false)
  })
})

describe('admin session token', () => {
  const claims = { email: 'owner@forge.dev', role: 'owner' as const, permissions: [...ALL_AREAS], exp: Date.now() + 10000 }

  it('round-trips a valid session', () => {
    const verified = verifyAdminSession(signAdminSession(claims))
    expect(verified?.email).toBe('owner@forge.dev')
    expect(verified?.role).toBe('owner')
  })

  it('rejects a tampered signature', () => {
    const token = signAdminSession(claims)
    expect(verifyAdminSession(token.slice(0, -2) + 'xx')).toBeNull()
  })

  it('rejects an expired session', () => {
    expect(verifyAdminSession(signAdminSession({ ...claims, exp: Date.now() - 1 }))).toBeNull()
  })

  it('rejects empty / malformed tokens', () => {
    expect(verifyAdminSession(undefined)).toBeNull()
    expect(verifyAdminSession('garbage')).toBeNull()
  })
})

describe('InMemoryAdminStore', () => {
  it('creates the owner on first login and grants all areas', async () => {
    const store = new InMemoryAdminStore()
    const r = await store.login('owner@forge.dev', 'ownerpass1')
    expect(r.ok && r.role).toBe('owner')
    expect(r.ok && r.permissions).toEqual(ALL_AREAS)
  })

  it('rejects a wrong owner password after setup', async () => {
    const store = new InMemoryAdminStore()
    await store.login('owner@forge.dev', 'ownerpass1')
    const bad = await store.login('owner@forge.dev', 'wrongpass1')
    expect(bad.ok).toBe(false)
  })

  it('lets an owner create an admin who can then log in with granted areas', async () => {
    const store = new InMemoryAdminStore()
    await store.login('owner@forge.dev', 'ownerpass1')
    const created = await store.createAdmin('helper@forge.dev', 'helperpass1', ['billing'])
    expect(created.role).toBe('admin')
    const login = await store.login('helper@forge.dev', 'helperpass1')
    expect(login.ok && login.role).toBe('admin')
    expect(login.ok && login.permissions).toEqual(['billing'])
  })

  it('refuses to create an admin from an owner email', async () => {
    const store = new InMemoryAdminStore()
    await expect(store.createAdmin('owner@forge.dev', 'whatever1', [])).rejects.toThrow()
  })

  it('refuses a too-short admin password', async () => {
    const store = new InMemoryAdminStore()
    await expect(store.createAdmin('x@forge.dev', 'short', [])).rejects.toThrow()
  })

  it('rejects login for an unknown non-owner email', async () => {
    const store = new InMemoryAdminStore()
    const r = await store.login('stranger@forge.dev', 'whatever1')
    expect(r.ok).toBe(false)
  })

  it('updates an admin permission set and removes the admin', async () => {
    const store = new InMemoryAdminStore()
    await store.login('owner@forge.dev', 'ownerpass1')
    const a = await store.createAdmin('helper@forge.dev', 'helperpass1', ['billing'])
    const updated = await store.setPermissions(a.id, ['users', 'system'])
    expect(updated.permissions).toEqual(['users', 'system'])
    await store.removeAdmin(a.id)
    expect(await store.listAdmins()).toHaveLength(0)
  })

  it('gates owner first-login behind OWNER_SETUP_SECRET when set', async () => {
    process.env.OWNER_SETUP_SECRET = 'launch-code'
    const store = new InMemoryAdminStore()
    const blocked = await store.login('owner@forge.dev', 'ownerpass1')
    expect(blocked.ok).toBe(false)
    const ok = await store.login('owner@forge.dev', 'ownerpass1', { setupSecret: 'launch-code' })
    expect(ok.ok && ok.role).toBe('owner')
    delete process.env.OWNER_SETUP_SECRET
  })

  it('knows who is an owner', () => {
    expect(isOwner('owner@forge.dev')).toBe(true)
    expect(isOwner('OWNER@FORGE.DEV')).toBe(true)
    expect(isOwner('nope@forge.dev')).toBe(false)
  })

  it('returns the same error for unknown email and wrong password (no enumeration)', async () => {
    const store = new InMemoryAdminStore()
    await store.login('owner@forge.dev', 'ownerpass1')
    await store.createAdmin('helper@forge.dev', 'helperpass1', ['billing'])
    const unknown = await store.login('ghost@forge.dev', 'whatever1')
    const wrongPw = await store.login('helper@forge.dev', 'wrongpass1')
    expect(unknown.ok).toBe(false)
    expect(wrongPw.ok).toBe(false)
    expect(unknown.ok === false && unknown.error).toBe('Invalid email or password.')
    expect(wrongPw.ok === false && wrongPw.error).toBe('Invalid email or password.')
  })

  it('locks owner bootstrap in production when OWNER_SETUP_SECRET is unset', async () => {
    const prev = process.env.NODE_ENV
    // @ts-expect-error NODE_ENV is writable in the test runner
    process.env.NODE_ENV = 'production'
    delete process.env.OWNER_SETUP_SECRET
    try {
      const store = new InMemoryAdminStore()
      const r = await store.login('owner@forge.dev', 'ownerpass1')
      expect(r.ok).toBe(false)
    } finally {
      // @ts-expect-error restore
      process.env.NODE_ENV = prev
    }
  })

  it('setPermissions rejects an unknown target id', async () => {
    const store = new InMemoryAdminStore()
    await store.login('owner@forge.dev', 'ownerpass1')
    await expect(store.setPermissions('does-not-exist', ['billing'])).rejects.toThrow()
  })
})
