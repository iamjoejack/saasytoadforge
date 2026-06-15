import { NextResponse } from 'next/server'
import { currentUser } from '@/lib/auth/server'
import { isAdminEmail } from '@forge/shared'

export async function GET() {
  const user = await currentUser()
  if (!user) return NextResponse.json({ user: null })

  const adminEmails = process.env.ADMIN_EMAILS ?? 'admin@forge.dev'
  const isAdmin = isAdminEmail(user.email, adminEmails)

  return NextResponse.json({ user: { ...user, isAdmin } })
}
