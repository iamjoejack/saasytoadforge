import { NextResponse } from 'next/server'
import { currentAdmin } from '@/lib/admin/server'

export async function GET() {
  const admin = await currentAdmin()
  if (!admin) return NextResponse.json({ admin: null })
  return NextResponse.json({
    admin: { email: admin.email, role: admin.role, permissions: admin.permissions },
  })
}
