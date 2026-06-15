import { NextResponse } from 'next/server'
import { currentAdmin } from '@/lib/admin/server'
import { getAdminStore } from '@/lib/admin/store'
import { canManageAdmins, sanitizeAreas } from '@/lib/admin/permissions'

/** Remove an admin. Owner-only. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await currentAdmin()
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!canManageAdmins(admin.role)) {
    return NextResponse.json({ error: 'Only an owner can remove admins.' }, { status: 403 })
  }
  const { id } = await params
  try {
    await getAdminStore().removeAdmin(id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not remove admin.' }, { status: 400 })
  }
}

/** Change an admin's back-office access. Owner-only. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await currentAdmin()
  if (!admin) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!canManageAdmins(admin.role)) {
    return NextResponse.json({ error: 'Only an owner can change access.' }, { status: 403 })
  }
  const { id } = await params
  const body = (await req.json().catch(() => ({}))) as { permissions?: unknown }
  try {
    const record = await getAdminStore().setPermissions(id, sanitizeAreas(body.permissions))
    return NextResponse.json({ admin: record })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not update access.' }, { status: 400 })
  }
}
