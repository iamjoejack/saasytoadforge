import { NextResponse } from 'next/server'
import { currentUser } from '@/lib/auth/server'

export async function GET() {
  const user = await currentUser()
  if (!user) return NextResponse.json({ user: null })

  // Back-office access follows the stamped forge_role, the same authority the admin store
  // enforces. Matching a published owner/admin email address is not enough: a squatter who
  // signed up through the customer flow would otherwise be shown the back-office door.
  const isAdmin = user.forgeRole !== null

  return NextResponse.json({ user: { ...user, isAdmin } })
}
