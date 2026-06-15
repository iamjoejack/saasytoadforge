import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getAuthProvider, SESSION_COOKIE } from '@/lib/auth/server'

export async function POST() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  if (token) await getAuthProvider().signOut(token)
  const res = NextResponse.json({ ok: true })
  res.cookies.set(SESSION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 })
  return res
}
