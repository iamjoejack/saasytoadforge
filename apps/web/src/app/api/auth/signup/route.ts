import { NextResponse } from 'next/server'
import { getAuthProvider, SESSION_COOKIE } from '@/lib/auth/server'
import { AuthError } from '@/lib/auth/types'
import { isOwner } from '@/lib/admin/store'

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { email?: string; password?: string }
  // Owner emails are reserved for the back office. Do not let the public customer signup
  // create an account on an owner email (which would otherwise let it be claimed there).
  if (isOwner(body.email ?? '')) {
    return NextResponse.json(
      { error: 'This email is reserved. Owners and admins sign in at the back office.' },
      { status: 403 },
    )
  }
  try {
    const session = await getAuthProvider().signUp(body.email ?? '', body.password ?? '')
    const res = NextResponse.json({ user: session.user })
    res.cookies.set(SESSION_COOKIE, session.token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    })
    return res
  } catch (err) {
    const message = err instanceof AuthError ? err.message : 'sign up failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
