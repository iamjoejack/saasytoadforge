import { NextResponse } from 'next/server'
import { currentUser } from '@/lib/auth/server'

export async function GET() {
  return NextResponse.json({ user: await currentUser() })
}
