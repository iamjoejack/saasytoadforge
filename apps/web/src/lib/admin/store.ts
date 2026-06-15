import crypto from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { OWNER_EMAILS as DEFAULT_OWNERS } from '@forge/shared'
import { ALL_AREAS, sanitizeAreas, type AdminRole, type AreaKey } from './permissions'

export interface AdminRecord {
  id: string
  email: string
  role: AdminRole
  permissions: AreaKey[]
  createdAt: string
}

export type LoginResult =
  | { ok: true; email: string; role: AdminRole; permissions: AreaKey[] }
  | { ok: false; error: string }

/** Owner emails: env override (OWNER_EMAILS) or the shared default list. */
export function ownerEmails(): string[] {
  const env = process.env.OWNER_EMAILS
  const list = env ? env.split(',') : [...DEFAULT_OWNERS]
  return list.map((e) => e.trim().toLowerCase()).filter(Boolean)
}

export function isOwner(email: string | null | undefined): boolean {
  if (!email) return false
  return ownerEmails().includes(email.trim().toLowerCase())
}

export interface LoginOptions {
  /** Required for first-time owner setup when OWNER_SETUP_SECRET is configured. */
  setupSecret?: string
}

/**
 * Owner first-login is bootstrap: the first person to log in with an owner email sets its
 * password. To stop someone from squatting an owner email before the real owner sets up,
 * set OWNER_SETUP_SECRET; first-time owner creation then requires it. Existing accounts
 * always verify their password and ignore the setup secret.
 */
function ownerBootstrapBlocked(opts?: LoginOptions): string | null {
  const required = process.env.OWNER_SETUP_SECRET
  if (required) {
    return opts?.setupSecret === required
      ? null
      : 'First-time owner setup requires the setup code. Ask the company for OWNER_SETUP_SECRET.'
  }
  // Fail closed in production: never let a public owner email self-provision an owner
  // without an out-of-band proof. Owners must set OWNER_SETUP_SECRET or be seeded.
  if (process.env.NODE_ENV === 'production') {
    return 'Owner setup is locked. Set OWNER_SETUP_SECRET or provision the owner out of band.'
  }
  return null
}

export interface AdminStore {
  /** Verify owner/admin credentials. Owners are created on first login with their chosen password. */
  login(email: string, password: string, opts?: LoginOptions): Promise<LoginResult>
  listAdmins(): Promise<AdminRecord[]>
  createAdmin(email: string, password: string, permissions: AreaKey[]): Promise<AdminRecord>
  removeAdmin(id: string): Promise<void>
  setPermissions(id: string, permissions: AreaKey[]): Promise<AdminRecord>
  readonly kind: 'supabase' | 'memory'
}

// ---- scrypt password hashing (used by the dev store) ----
function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16)
  const derived = crypto.scryptSync(password, salt, 32)
  return `${salt.toString('hex')}:${derived.toString('hex')}`
}
function verifyPassword(password: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(':')
  if (!saltHex || !hashHex) return false
  const derived = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), 32)
  const expected = Buffer.from(hashHex, 'hex')
  return derived.length === expected.length && crypto.timingSafeEqual(derived, expected)
}

const MIN_PASSWORD = 8

/**
 * Supabase-backed admin store. Admins are Supabase auth users whose app_metadata carries
 * `forge_role` and `forge_permissions`. Owners are identified by the owner email list and
 * always have all permissions. No custom tables; uses the Auth admin API (service role).
 */
export class SupabaseAdminStore implements AdminStore {
  readonly kind = 'supabase' as const
  private readonly service: SupabaseClient
  constructor(
    private readonly url: string,
    serviceRoleKey: string,
    private readonly anonKey: string,
  ) {
    this.service = createClient(url, serviceRoleKey, { auth: { persistSession: false } })
  }

  private async findByEmail(email: string) {
    const target = email.trim().toLowerCase()
    // Small admin set: a single page is plenty. Bump perPage if this ever grows.
    const { data, error } = await this.service.auth.admin.listUsers({ page: 1, perPage: 200 })
    if (error) throw new Error(error.message)
    return data.users.find((u) => (u.email ?? '').toLowerCase() === target) ?? null
  }

  async login(email: string, password: string, opts?: LoginOptions): Promise<LoginResult> {
    const owner = isOwner(email)
    const existing = await this.findByEmail(email)

    if (!existing) {
      // Uniform message for non-owner unknown emails (no account-enumeration oracle).
      if (!owner) return { ok: false, error: 'Invalid email or password.' }
      const blocked = ownerBootstrapBlocked(opts)
      if (blocked) return { ok: false, error: blocked }
      if (password.length < MIN_PASSWORD) return { ok: false, error: `Password must be at least ${MIN_PASSWORD} characters.` }
      // First-time owner setup: create the owner, stamping the explicit owner role.
      const { error } = await this.service.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        app_metadata: { forge_role: 'owner' },
      })
      if (error) {
        console.error('owner bootstrap failed:', error.message)
        return { ok: false, error: 'Could not complete owner setup.' }
      }
      return { ok: true, email: email.toLowerCase(), role: 'owner', permissions: [...ALL_AREAS] }
    }

    // Verify the password with a throwaway anon client (no session persistence).
    const anon = createClient(this.url, this.anonKey, { auth: { persistSession: false } })
    const { error: signInError } = await anon.auth.signInWithPassword({ email, password })
    if (signInError) return { ok: false, error: 'Invalid email or password.' }

    const role = (existing.app_metadata as { forge_role?: string } | null)?.forge_role
    if (owner) {
      // Owner status requires the explicit forge_role stamp set only by bootstrap/reclaim, not
      // mere membership in the public owner-email list. This blocks owner-email squatting through
      // the shared customer signup pool.
      if (role !== 'owner') {
        // Reclaim: an owner-email account that exists without the owner stamp (e.g. created
        // earlier as a customer) can be promoted, but only with the same proof bootstrap
        // requires (OWNER_SETUP_SECRET, or dev). The password was already verified above, so a
        // squatter without the setup code cannot reach this.
        const blocked = ownerBootstrapBlocked(opts)
        if (blocked) return { ok: false, error: blocked }
        const meta = (existing.app_metadata as Record<string, unknown> | null) ?? {}
        const { error: upErr } = await this.service.auth.admin.updateUserById(existing.id, {
          app_metadata: { ...meta, forge_role: 'owner' },
        })
        if (upErr) {
          console.error('owner reclaim failed:', upErr.message)
          return { ok: false, error: 'Could not complete owner setup.' }
        }
      }
      return { ok: true, email: email.toLowerCase(), role: 'owner', permissions: [...ALL_AREAS] }
    }
    if (role !== 'admin') return { ok: false, error: 'This account does not have back-office access.' }
    const perms = sanitizeAreas((existing.app_metadata as { forge_permissions?: unknown }).forge_permissions)
    return { ok: true, email: (existing.email ?? email).toLowerCase(), role: 'admin', permissions: perms }
  }

  async listAdmins(): Promise<AdminRecord[]> {
    const { data, error } = await this.service.auth.admin.listUsers({ page: 1, perPage: 200 })
    if (error) throw new Error(error.message)
    return data.users
      .filter((u) => (u.app_metadata as { forge_role?: string } | null)?.forge_role === 'admin')
      .map((u) => ({
        id: u.id,
        email: u.email ?? '',
        role: 'admin' as const,
        permissions: sanitizeAreas((u.app_metadata as { forge_permissions?: unknown }).forge_permissions),
        createdAt: u.created_at ?? '',
      }))
  }

  async createAdmin(email: string, password: string, permissions: AreaKey[]): Promise<AdminRecord> {
    if (isOwner(email)) throw new Error('That email is an owner and cannot be added as an admin.')
    if (password.length < MIN_PASSWORD) throw new Error(`Password must be at least ${MIN_PASSWORD} characters.`)
    if (await this.findByEmail(email)) throw new Error('An account with that email already exists.')
    const { data, error } = await this.service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { forge_role: 'admin', forge_permissions: sanitizeAreas(permissions) },
    })
    if (error || !data.user) {
      console.error('createAdmin failed:', error?.message)
      throw new Error('Could not create admin.')
    }
    return {
      id: data.user.id,
      email: data.user.email ?? email,
      role: 'admin',
      permissions: sanitizeAreas(permissions),
      createdAt: data.user.created_at ?? '',
    }
  }

  async removeAdmin(id: string): Promise<void> {
    const { data } = await this.service.auth.admin.getUserById(id)
    if (!data.user) throw new Error('Admin not found.')
    if (isOwner(data.user.email)) throw new Error('Owners cannot be removed.')
    // Only remove accounts that are actually forge admins, never arbitrary users.
    if ((data.user.app_metadata as { forge_role?: string } | null)?.forge_role !== 'admin') {
      throw new Error('That account is not an admin.')
    }
    const { error } = await this.service.auth.admin.deleteUser(id)
    if (error) {
      console.error('removeAdmin failed:', error.message)
      throw new Error('Could not remove admin.')
    }
  }

  async setPermissions(id: string, permissions: AreaKey[]): Promise<AdminRecord> {
    // Guard the target: never let a permission change mint an admin out of an arbitrary
    // user id (e.g. a customer). The target must already be a forge admin, never an owner.
    const { data: cur } = await this.service.auth.admin.getUserById(id)
    if (!cur.user) throw new Error('Admin not found.')
    if (isOwner(cur.user.email)) throw new Error('Owners cannot be modified here.')
    if ((cur.user.app_metadata as { forge_role?: string } | null)?.forge_role !== 'admin') {
      throw new Error('That account is not an admin.')
    }
    const { data, error } = await this.service.auth.admin.updateUserById(id, {
      app_metadata: { forge_role: 'admin', forge_permissions: sanitizeAreas(permissions) },
    })
    if (error || !data.user) {
      console.error('setPermissions failed:', error?.message)
      throw new Error('Could not update permissions.')
    }
    return {
      id: data.user.id,
      email: data.user.email ?? '',
      role: 'admin',
      permissions: sanitizeAreas(permissions),
      createdAt: data.user.created_at ?? '',
    }
  }
}

/** In-memory store for local dev (no Supabase). Not persistent across restarts. */
export class InMemoryAdminStore implements AdminStore {
  readonly kind = 'memory' as const
  private readonly byEmail = new Map<
    string,
    { id: string; email: string; role: AdminRole; permissions: AreaKey[]; passwordHash: string; createdAt: string }
  >()

  async login(email: string, password: string, opts?: LoginOptions): Promise<LoginResult> {
    const key = email.trim().toLowerCase()
    const owner = isOwner(email)
    const existing = this.byEmail.get(key)
    if (!existing) {
      if (!owner) return { ok: false, error: 'Invalid email or password.' }
      const blocked = ownerBootstrapBlocked(opts)
      if (blocked) return { ok: false, error: blocked }
      if (password.length < MIN_PASSWORD) return { ok: false, error: `Password must be at least ${MIN_PASSWORD} characters.` }
      this.byEmail.set(key, {
        id: crypto.randomUUID(),
        email: key,
        role: 'owner',
        permissions: [...ALL_AREAS],
        passwordHash: hashPassword(password),
        createdAt: new Date().toISOString(),
      })
      return { ok: true, email: key, role: 'owner', permissions: [...ALL_AREAS] }
    }
    if (!verifyPassword(password, existing.passwordHash)) return { ok: false, error: 'Invalid email or password.' }
    if (owner) {
      // Owner requires the explicit stored owner role, not just an owner-listed email.
      // Reclaim an owner-email account lacking the role with the same proof bootstrap needs.
      if (existing.role !== 'owner') {
        const blocked = ownerBootstrapBlocked(opts)
        if (blocked) return { ok: false, error: blocked }
        existing.role = 'owner'
        existing.permissions = [...ALL_AREAS]
      }
      return { ok: true, email: key, role: 'owner', permissions: [...ALL_AREAS] }
    }
    if (existing.role !== 'admin') return { ok: false, error: 'This account does not have back-office access.' }
    return { ok: true, email: key, role: 'admin', permissions: existing.permissions }
  }

  async listAdmins(): Promise<AdminRecord[]> {
    return [...this.byEmail.values()]
      .filter((r) => r.role === 'admin')
      .map(({ id, email, role, permissions, createdAt }) => ({ id, email, role, permissions, createdAt }))
  }

  async createAdmin(email: string, password: string, permissions: AreaKey[]): Promise<AdminRecord> {
    const key = email.trim().toLowerCase()
    if (isOwner(key)) throw new Error('That email is an owner and cannot be added as an admin.')
    if (password.length < MIN_PASSWORD) throw new Error(`Password must be at least ${MIN_PASSWORD} characters.`)
    if (this.byEmail.has(key)) throw new Error('An account with that email already exists.')
    const record = {
      id: crypto.randomUUID(),
      email: key,
      role: 'admin' as const,
      permissions: sanitizeAreas(permissions),
      passwordHash: hashPassword(password),
      createdAt: new Date().toISOString(),
    }
    this.byEmail.set(key, record)
    const { id, role, permissions: perms, createdAt } = record
    return { id, email: key, role, permissions: perms, createdAt }
  }

  async removeAdmin(id: string): Promise<void> {
    for (const [key, r] of this.byEmail) {
      if (r.id === id) {
        if (r.role === 'owner') throw new Error('Owners cannot be removed.')
        this.byEmail.delete(key)
        return
      }
    }
  }

  async setPermissions(id: string, permissions: AreaKey[]): Promise<AdminRecord> {
    for (const r of this.byEmail.values()) {
      if (r.id === id && r.role === 'admin') {
        r.permissions = sanitizeAreas(permissions)
        const { email, role, createdAt } = r
        return { id, email, role, permissions: r.permissions, createdAt }
      }
    }
    throw new Error('Admin not found.')
  }
}

let cached: AdminStore | null = null

/** The active admin store: Supabase when the service role is configured, else in-memory. */
export function getAdminStore(): AdminStore {
  if (cached) return cached
  const url = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const anonKey = process.env.SUPABASE_ANON_KEY
  if (url && serviceKey && anonKey) {
    cached = new SupabaseAdminStore(url, serviceKey, anonKey)
  } else {
    cached = new InMemoryAdminStore()
  }
  return cached
}
