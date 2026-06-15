import { NextResponse } from 'next/server'
import { getAdminStore } from '@/lib/admin/store'
import { ADMIN_COOKIE, ADMIN_SESSION_TTL_MS, signAdminSession } from '@/lib/admin/session'

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { email?: unknown; password?: unknown }
  const email = typeof body.email === 'string' ? body.email.trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 })
  }

  let result
  try {
    result = await getAdminStore().login(email, password)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Login failed.' }, { status: 500 })
  }
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 401 })

  const exp = Date.now() + ADMIN_SESSION_TTL_MS
  const token = signAdminSession({
    email: result.email,
    role: result.role,
    permissions: result.permissions,
    exp,
  })
  const res = NextResponse.json({
    ok: true,
    admin: { email: result.email, role: result.role, permissions: result.permissions },
  })
  res.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: Math.floor(ADMIN_SESSION_TTL_MS / 1000),
  })
  return res
}
