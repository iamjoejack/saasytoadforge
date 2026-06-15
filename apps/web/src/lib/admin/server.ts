import { cookies } from 'next/headers'
import { ADMIN_COOKIE, verifyAdminSession, type AdminClaims } from './session'

/** The current admin/owner session from the forge_admin cookie, or null. */
export async function currentAdmin(): Promise<AdminClaims | null> {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value
  return verifyAdminSession(token)
}
