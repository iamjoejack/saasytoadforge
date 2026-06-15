import { NextResponse } from 'next/server'
import { currentAdmin } from '@/lib/admin/server'
import { getAdminStore } from '@/lib/admin/store'
import { canManageAdmins, sanitizeAreas } from '@/lib/admin/permissions'

/** List admins. Visible to owners and to admins granted the "users" area. */
export async function GET() {
  const admin = await currentAdmin()
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (admin.role !== 'owner' && !admin.permissions.includes('users')) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }
  const admins = await getAdminStore().listAdmins()
  return NextResponse.json({ admins })
}

/** Create an admin. Owner-only. */
export async function POST(req: Request) {
  const admin = await currentAdmin()
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!canManageAdmins(admin.role)) {
    return NextResponse.json({ error: 'Only an owner can create admins.' }, { status: 403 })
  }
  const body = (await req.json().catch(() => ({}))) as {
    email?: unknown
    password?: unknown
    permissions?: unknown
  }
  const email = typeof body.email === 'string' ? body.email.trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 })
  }
  try {
    const record = await getAdminStore().createAdmin(email, password, sanitizeAreas(body.permissions))
    return NextResponse.json({ admin: record })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not create admin.' }, { status: 400 })
  }
}
