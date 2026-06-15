import { NextResponse, type NextRequest } from 'next/server'
import { SESSION_COOKIE } from '@/lib/auth/constants'

/** Gate the app behind a session. Presence-check only (edge); the API validates the token. */
export function middleware(req: NextRequest) {
  if (req.cookies.get(SESSION_COOKIE)?.value) return NextResponse.next()
  const url = req.nextUrl.clone()
  url.pathname = '/signin'
  url.searchParams.set('next', req.nextUrl.pathname)
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ['/workspaces', '/workspaces/:path*', '/settings'],
}
