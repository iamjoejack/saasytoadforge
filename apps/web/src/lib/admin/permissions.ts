/**
 * Owner/admin role model for the back office.
 *
 * - owner: hardcoded company emails (shared OWNER_EMAILS). Owners have every permission,
 *   and are the ONLY accounts that can create or remove admins or change permissions.
 * - admin: created by an owner. Has only the back-office areas an owner has granted.
 */
export type AdminRole = 'owner' | 'admin'

/** The back-office areas an owner can grant to an admin. */
export const BACK_OFFICE_AREAS = [
  { key: 'users', label: 'User and admin management', desc: 'Create and remove admins, set their access.' },
  { key: 'billing', label: 'Billing and usage', desc: 'View revenue, plans, and spend across workspaces.' },
  { key: 'system', label: 'System and config', desc: 'View service config, integration status, and health.' },
  { key: 'content', label: 'Product and marketing', desc: 'Control product status and marketing copy.' },
] as const

export type AreaKey = (typeof BACK_OFFICE_AREAS)[number]['key']

export const ALL_AREAS: AreaKey[] = BACK_OFFICE_AREAS.map((a) => a.key)

/** Keep only valid area keys from arbitrary input. */
export function sanitizeAreas(input: unknown): AreaKey[] {
  if (!Array.isArray(input)) return []
  const valid = new Set<string>(ALL_AREAS)
  return input.filter((a): a is AreaKey => typeof a === 'string' && valid.has(a))
}

/** Effective permissions: owners always have all areas; admins have their granted subset. */
export function effectivePermissions(role: AdminRole, granted: AreaKey[]): AreaKey[] {
  return role === 'owner' ? [...ALL_AREAS] : sanitizeAreas(granted)
}

export interface AdminSessionLike {
  role: AdminRole
  permissions: AreaKey[]
}

/** Can this session view/use a back-office area? Owners can access everything. */
export function canAccess(session: AdminSessionLike, area: AreaKey): boolean {
  return session.role === 'owner' || session.permissions.includes(area)
}

/** Only owners may manage admins, regardless of any granted area. */
export function canManageAdmins(role: AdminRole): boolean {
  return role === 'owner'
}
