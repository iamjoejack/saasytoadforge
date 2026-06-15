import { NextResponse } from 'next/server'
import { getAuthProvider, SESSION_COOKIE } from '@/lib/auth/server'
import { AuthError } from '@/lib/auth/types'

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { email?: string; password?: string }
  try {
    const session = await getAuthProvider().signIn(body.email ?? '', body.password ?? '')
    const res = NextResponse.json({ user: session.user })
    res.cookies.set(SESSION_COOKIE, session.token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    })
    return res
  } catch (err) {
    const message = err instanceof AuthError ? err.message : 'sign in failed'
    return NextResponse.json({ error: message }, { status: 401 })
  }
}
